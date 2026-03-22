import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import TemplatePreview from '../../app/components/TemplatePreview.vue'

// Stub Nuxt's auto-imported $fetch
const fetchMock = vi.fn()

// Stub Nuxt UI components
const UCard = defineComponent({
  props: ['modelValue'],
  setup(_, { slots }) {
    return () => h('div', { class: 'u-card' }, [
      slots.header?.(),
      slots.default?.(),
    ])
  },
})

const UModal = defineComponent({
  props: ['open'],
  emits: ['update:open'],
  setup(props, { slots }) {
    return () => props.open ? h('div', { class: 'u-modal' }, slots.content?.()) : null
  },
})

const UButton = defineComponent({
  props: ['size', 'variant', 'icon', 'loading', 'disabled', 'color'],
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () => h('button', {
      disabled: props.disabled,
      onClick: () => emit('click'),
    }, slots.default?.())
  },
})

const UAlert = defineComponent({
  props: ['color', 'variant', 'icon', 'title'],
  setup(props) {
    return () => h('div', { class: `u-alert ${props.color}` }, props.title)
  },
})

const UIcon = defineComponent({
  props: ['name'],
  setup() {
    return () => h('span')
  },
})

const stubs = { UCard, UModal, UButton, UAlert, UIcon }

// Stub Nuxt auto-imports
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('ref', ref)

const feedItems = [
  { title: 'Post One', link: 'https://example.com/1', description: 'Desc 1', content: '', author: 'Alice', pubDate: '2024-01-01' },
  { title: 'Post Two', link: 'https://example.com/2', description: 'Desc 2', content: '', author: 'Bob', pubDate: '2024-01-02' },
]

describe('TemplatePreview post confirmation', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/items')) return Promise.resolve(feedItems)
      return Promise.resolve({})
    })
  })

  it('does not post immediately when Post button is clicked', async () => {
    const wrapper = mount(TemplatePreview, {
      props: { sourceId: 'src-1', template: '{{title}} {{link}}', connectionId: 'conn-1', maxCharacters: 300 },
      global: { stubs },
    })
    await flushPromises()

    // Find the first "Post" button (skip non-post buttons)
    const buttons = wrapper.findAll('button')
    const postButton = buttons.find(b => b.text().includes('Post'))
    expect(postButton).toBeTruthy()

    await postButton!.trigger('click')
    await flushPromises()

    // Should NOT have called the post-item endpoint
    const postCalls = fetchMock.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('post-item'),
    )
    expect(postCalls).toHaveLength(0)
  })

  it('opens confirmation modal with post content on click', async () => {
    const wrapper = mount(TemplatePreview, {
      props: { sourceId: 'src-1', template: '{{title}} {{link}}', connectionId: 'conn-1', maxCharacters: 300 },
      global: { stubs },
    })
    await flushPromises()

    const postButton = wrapper.findAll('button').find(b => b.text().includes('Post'))
    await postButton!.trigger('click')
    await flushPromises()

    // Modal should now be visible
    const modal = wrapper.find('.u-modal')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('Confirm post')
    expect(modal.text()).toContain('Post One')
  })

  it('posts only after confirming in the modal', async () => {
    const wrapper = mount(TemplatePreview, {
      props: { sourceId: 'src-1', template: '{{title}} {{link}}', connectionId: 'conn-1', maxCharacters: 300 },
      global: { stubs },
    })
    await flushPromises()

    // Click "Post" to open modal
    const postButton = wrapper.findAll('button').find(b => b.text().includes('Post'))
    await postButton!.trigger('click')
    await flushPromises()

    // Click "Post" inside the modal to confirm
    const modal = wrapper.find('.u-modal')
    const confirmButton = modal.findAll('button').find(b => b.text().includes('Post'))
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')
    await flushPromises()

    // Now the post-item endpoint should have been called
    const postCalls = fetchMock.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('post-item'),
    )
    expect(postCalls).toHaveLength(1)
    expect(postCalls[0][0]).toContain('/api/connections/conn-1/post-item')
  })

  it('does not post when Cancel is clicked in the modal', async () => {
    const wrapper = mount(TemplatePreview, {
      props: { sourceId: 'src-1', template: '{{title}} {{link}}', connectionId: 'conn-1', maxCharacters: 300 },
      global: { stubs },
    })
    await flushPromises()

    // Click "Post" to open modal
    const postButton = wrapper.findAll('button').find(b => b.text().includes('Post'))
    await postButton!.trigger('click')
    await flushPromises()

    // Click "Cancel" inside the modal
    const modal = wrapper.find('.u-modal')
    const cancelButton = modal.findAll('button').find(b => b.text().includes('Cancel'))
    expect(cancelButton).toBeTruthy()
    await cancelButton!.trigger('click')
    await flushPromises()

    // Should NOT have called the post-item endpoint
    const postCalls = fetchMock.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('post-item'),
    )
    expect(postCalls).toHaveLength(0)
  })
})
