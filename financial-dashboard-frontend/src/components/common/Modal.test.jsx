import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from '../admin/AdminChrome'
import { Modal } from './Ui'

const FormDialog = ({ onClose }) => (
  <Modal title="New user" onClose={onClose}>
    <form>
      <label>
        Username
        <input name="username" />
      </label>
      <button type="button">Cancel</button>
      <button type="submit">Save</button>
    </form>
  </Modal>
)

describe('Modal', () => {
  it('gives each dialog its own title id', () => {
    render(
      <>
        <Modal title="First" onClose={() => {}}>
          <p>One</p>
        </Modal>
        <Modal title="Second" onClose={() => {}}>
          <p>Two</p>
        </Modal>
      </>,
    )

    const [first, second] = screen.getAllByRole('dialog', { hidden: true })
    expect(first).toHaveAttribute('aria-modal', 'true')
    expect(second).toHaveAttribute('aria-modal', 'true')
    expect(first.getAttribute('aria-labelledby')).not.toBe(second.getAttribute('aria-labelledby'))
    expect(document.getElementById(first.getAttribute('aria-labelledby'))).toHaveTextContent('First')
    expect(document.getElementById(second.getAttribute('aria-labelledby'))).toHaveTextContent('Second')
  })

  it('traps focus, closes on Escape, and restores the opener and page scroll', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    document.body.style.overflow = 'scroll'
    document.documentElement.style.overflow = 'auto'

    render(
      <>
        <p id="current-page" tabIndex={-1}>
          Page
        </p>
        <button type="button">Outside</button>
        <FormDialog onClose={onClose} />
      </>,
    )

    const dialog = screen.getByRole('dialog')
    const outside = screen.getByText('Outside')
    expect(dialog).toHaveFocus()
    expect(outside).toHaveAttribute('inert')
    expect(outside).toHaveAttribute('aria-hidden', 'true')
    expect(document.body.style.overflow).toBe('hidden')

    await user.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Username' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()

    await user.click(dialog.parentElement)
    expect(onClose).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('returns focus to the opener and restores scroll when the dialog closes', async () => {
    const user = userEvent.setup()
    const scrollX = vi.spyOn(window, 'scrollX', 'get').mockReturnValue(18)
    const scrollY = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(240)
    document.body.style.overflow = 'scroll'
    document.documentElement.style.overflow = 'auto'

    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {open && <FormDialog onClose={() => setOpen(false)} />}
        </>
      )
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Open' })).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('scroll')
    expect(document.documentElement.style.overflow).toBe('auto')
    expect(window.scrollTo).toHaveBeenCalledWith(18, 240)
    scrollX.mockRestore()
    scrollY.mockRestore()
  })

  it('falls back to the page heading when the opener is gone', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [open, setOpen] = useState(false)
      const [visible, setVisible] = useState(true)
      return (
        <>
          <p id="current-page" tabIndex={-1}>
            Page
          </p>
          {visible && (
            <button
              type="button"
              onClick={() => setOpen(true)}
            >
              Open
            </button>
          )}
          {open && (
            <FormDialog
              onClose={() => {
                setVisible(false)
                setOpen(false)
              }}
            />
          )}
        </>
      )
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.keyboard('{Escape}')
    expect(document.getElementById('current-page')).toHaveFocus()
  })
})

describe('ConfirmDialog', () => {
  it('describes the dialog, starts on Cancel, and confirms once', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmDialog
        title="Delete this to-do?"
        message="The to-do will be removed."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    )

    const dialog = screen.getByRole('dialog')
    const description = screen.getByText('The to-do will be removed.')
    expect(dialog).toHaveAttribute('aria-describedby', description.id)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not leave Confirm available while the action is pending', () => {
    render(
      <ConfirmDialog
        title="Delete this to-do?"
        message="The to-do will be removed."
        confirmLabel="Delete"
        pending
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
  })
})
