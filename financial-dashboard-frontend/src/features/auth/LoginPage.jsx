// src/features/auth/LoginPage.jsx
import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button, Input } from '../../components/common/Ui'
import { extractError } from '../../services/http'
import { useAuth } from './AuthProvider'

const LoginPage = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const onChange = (event) =>
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(form.username, form.password)
      navigate(location.state?.from || '/', { replace: true })
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
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-slate-800">Sign in</h1>
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Input
          label="Username"
          name="username"
          autoComplete="username"
          value={form.username}
          onChange={onChange}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={onChange}
          required
        />
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}

export default LoginPage
