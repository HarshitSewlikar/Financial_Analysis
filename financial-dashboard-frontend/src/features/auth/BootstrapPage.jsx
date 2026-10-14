// src/features/auth/BootstrapPage.jsx
import React, { useState } from 'react'

import { Button, Input } from '../../components/common/Ui'
import { extractError } from '../../services/http'
import { useAuth } from './AuthProvider'

const initialForm = {
  name: '',
  username: '',
  email: '',
  password: '',
  confirm_password: '',
  signup_code: '',
}

const BootstrapPage = () => {
  const { bootstrapAdmin } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const onChange = (event) =>
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await bootstrapAdmin({
        name: form.name || undefined,
        username: form.username,
        email: form.email || undefined,
        password: form.password,
        signup_code: form.signup_code,
      })
    } catch (err) {
      setError(extractError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Create the first administrator</h1>
          <p className="mt-1 text-sm text-slate-500">
            This one-time setup is only available until an administrator exists.
          </p>
        </div>
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Input label="Name" name="name" value={form.name} onChange={onChange} />
        <Input label="Username" name="username" value={form.username} onChange={onChange} required />
        <Input label="Email" name="email" type="email" value={form.email} onChange={onChange} />
        <Input
          label="Password"
          name="password"
          type="password"
          minLength={8}
          value={form.password}
          onChange={onChange}
          required
        />
        <Input
          label="Confirm password"
          name="confirm_password"
          type="password"
          minLength={8}
          value={form.confirm_password}
          onChange={onChange}
          required
        />
        <Input
          label="Setup code"
          name="signup_code"
          value={form.signup_code}
          onChange={onChange}
          required
        />
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Creating…' : 'Create administrator'}
        </Button>
      </form>
    </div>
  )
}

export default BootstrapPage
