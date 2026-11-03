// src/App.jsx
import React from 'react'

import { AuthProvider } from './features/auth/AuthProvider'
import { AppRoutes } from './app/router'

const App = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
)

export default App
