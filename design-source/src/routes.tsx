import { createBrowserRouter } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Home,
  },
  {
    path: '/dashboard',
    Component: Dashboard,
  },
])
