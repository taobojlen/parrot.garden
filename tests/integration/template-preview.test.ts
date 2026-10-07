import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import TemplatePreview from '../../app/components/TemplatePreview.vue'

enableAutoUnmount(afterEach)

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

const feedItems = [
  { title: 'Post One', link: 'https://example.com/1', description: 'Desc 1', content: '', author: 'Alice', pubDate: '2024-01-01' },
  { title: 'Post Two', link: 'https://example.com/2', description: 'Desc 2', content: '', author: 'Bob', pubDate: '2024-01-02' },
]

describe('TemplatePreview post confirmation', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/items')) return Promise.resolve(feedItems)
      return Promise.resolve({})
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('previews the selected item, posts only after confirmation, and shows success', async () => {
    const wrapper = mount(TemplatePreview, {
      props: { sourceId: 'src-1', template: '{{title}} {{link}}', connectionId: 'conn-1', maxCharacters: 300 },
      global: { stubs },
    })
    await flushPromises()

    const postButtons = wrapper.findAll('button').filter(b => b.text() === 'Post')
    await postButtons[1]!.trigger('click')
    await flushPromises()

    const modal = wrapper.find('.u-modal')
    expect(modal.text()).toContain('Confirm post')
    expect(modal.text()).toContain('Post Two https://example.com/2')
    expect(modal.text()).not.toContain('Post One')
    expect(fetchMock.mock.calls).toEqual([['/api/sources/src-1/items']])
    const confirmButton = modal.findAll('button').find(b => b.text() === 'Post')
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls).toEqual([
      ['/api/sources/src-1/items'],
      ['/api/connections/conn-1/post-item', { method: 'POST', body: { itemIndex: 1 } }],
    ])
    expect(wrapper.find('.u-modal').exists()).toBe(false)
    expect(wrapper.text()).toContain('Posted successfully')
    const postedButton = wrapper.findAll('button').find(b => b.text() === 'Posted')!
    expect((postedButton.element as HTMLButtonElement).disabled).toBe(true)
    expect((postButtons[0]!.element as HTMLButtonElement).disabled).toBe(false)
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

    expect(wrapper.find('.u-modal').exists()).toBe(false)
    expect(fetchMock.mock.calls).toEqual([['/api/sources/src-1/items']])
  })
})
