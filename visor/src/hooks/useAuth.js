import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, provider } from '../firebase'

const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_DOMAIN

export function useAuth() {
  const [user, setUser]       = useState(undefined) // undefined = cargando
  const [error, setError]     = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && !u.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
        signOut(auth)
        setError(`Solo cuentas @${ALLOWED_DOMAIN} pueden acceder.`)
        setUser(null)
      } else {
        setUser(u)
        setError(null)
      }
    })
    return unsub
  }, [])

  async function login() {
    setError(null)
    try {
      const result = await signInWithPopup(auth, provider)
      if (!result.user.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
        await signOut(auth)
        setError(`Solo cuentas @${ALLOWED_DOMAIN} pueden acceder.`)
      }
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('Error al iniciar sesión. Intenta de nuevo.')
      }
    }
  }

  async function logout() {
    await signOut(auth)
  }

  return { user, error, login, logout }
}
