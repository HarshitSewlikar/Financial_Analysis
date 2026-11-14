import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import { AdminPage, Outlined } from '../../components/admin/AdminChrome'
import { Button, Select } from '../../components/common/Ui'
import { extractError } from '../../services/http'
import { submitQuery } from '../../services/endpoints'

const CATEGORIES = [
  { value: 'technical', label: 'Technical Issue' },
  { value: 'data', label: 'Data / Analytics' },
  { value: 'account', label: 'Account / Access' },
  { value: 'general', label: 'General Question' },
  { value: 'other', label: 'Other' },
]

const EMPTY = { subject: '', category: 'technical', description: '' }

const QueryPage = () => {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const mutation = useMutation({
    mutationFn: submitQuery,
    onSuccess: () => {
      setForm(EMPTY)
      setError('')
      setSubmitted(true)
    },
    onError: (err) => {
      setSubmitted(false)
      setError(extractError(err))
    },
  })

  const onSubmit = (event) => {
    event.preventDefault()
    if (mutation.isPending) return
    const subject = form.subject.trim()
    const description = form.description.trim()
    if (!subject || !description) {
      setSubmitted(false)
      setError('Subject and description are required.')
      return
    }
    setError('')
    mutation.mutate({ subject, category: form.category, description })
  }

  return (
    <AdminPage
      className="mx-auto w-full max-w-[920px]"
      title="Submit a Request"
      description="Send a question or problem to the team. It is saved with your account."
    >
      <Outlined className="query-card">
        <form onSubmit={onSubmit} className="query-form grid gap-5">
          {submitted && (
            <p className="rounded-xl border border-emerald-200 bg-positive-soft px-3 py-2 text-sm text-positive" role="status">
              Your query was submitted.
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-red-200 bg-negative-soft px-3 py-2 text-sm text-negative" role="alert">
              {error}
            </p>
          )}
          <div className="grid items-end gap-4 min-[640px]:grid-cols-[minmax(0,1fr)_250px]">
            <label className="block min-w-0 text-sm">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Subject</span>
              <input
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                required
                maxLength={200}
                className="w-full border px-3 text-sm text-ink"
              />
            </label>
            <Select
              label="Category"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              required
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <label className="block text-sm">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              required
              className="w-full border px-3 py-2.5 text-sm text-ink"
            />
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending} aria-busy={mutation.isPending}>
              {mutation.isPending ? 'Submitting…' : 'Submit Query'}
            </Button>
          </div>
        </form>
      </Outlined>
    </AdminPage>
  )
}

export default QueryPage
