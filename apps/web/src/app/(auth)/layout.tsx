export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-white">PayrollPro</h1>
          <p className="text-blue-200">Sistem Manajemen Payroll Perusahaan</p>
        </div>
        {children}
        <div className="mt-8 text-center text-xs text-blue-300">
          © 2024 PayrollPro. All rights reserved.
        </div>
      </div>
    </div>
  )
}