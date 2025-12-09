import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/__authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h2>
      <p className="text-gray-600">Welcome to your dashboard.</p>
    </div>
  )
}
