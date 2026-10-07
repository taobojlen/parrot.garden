import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import ShroudAdvert from '../../app/components/ShroudAdvert.vue'

const dismissed = ref(false)
const session = ref<{ data: { user: { id: string } } | null }>({ data: { user: { id: 'user-1' } } })
vi.stubGlobal('useCookie', vi.fn(() => dismissed))
vi.stubGlobal('useSession', vi.fn(() => session))

function mountAdvert() {
  return mount(ShroudAdvert, { global: { stubs: { UIcon: true } } })
}

describe('Shroud advert', () => {
  beforeEach(() => {
    dismissed.value = false
    session.value = { data: { user: { id: 'user-1' } } }
  })

  it('hides the advert without a signed-in user', () => {
    session.value = { data: null }
    expect(mountAdvert().find('aside').exists()).toBe(false)
  })

  it('hides the advert when the user signs out', async () => {
    const wrapper = mountAdvert()
    expect(wrapper.find('aside').exists()).toBe(true)
    session.value = { data: null }
    await nextTick()
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it('shows the requested copy when signed in and links to Shroud.email with UTM tags', () => {
    const wrapper = mountAdvert()
    expect(wrapper.find('h2').text()).toBe('Email, meet privacy')
    expect(wrapper.find('p').text()).toBe('If you like parrot.garden, try my other project: free email aliases that keep your real address private.')
    expect(wrapper.find('a').text()).toContain('Try Shroud.email →')
    expect(wrapper.find('a').attributes('href')).toBe('https://shroud.email/?utm_source=parrot.garden&utm_medium=referral&utm_campaign=shroud_advert')
  })

  it('dismisses without following the link and stays dismissed on remount', async () => {
    const wrapper = mountAdvert()
    const button = wrapper.get('button[aria-label="Dismiss Shroud.email advert"]')
    expect(button.element.closest('a')).toBeNull()
    await button.trigger('click')
    expect(wrapper.find('aside').exists()).toBe(false)
    wrapper.unmount()
    expect(mountAdvert().find('aside').exists()).toBe(false)
    expect(useCookie).toHaveBeenCalledWith('shroud-advert-dismissed', expect.objectContaining({ maxAge: 31536000 }))
  })

  it('does not show the advert when already dismissed', () => {
    dismissed.value = true
    expect(mountAdvert().find('aside').exists()).toBe(false)
  })
})
