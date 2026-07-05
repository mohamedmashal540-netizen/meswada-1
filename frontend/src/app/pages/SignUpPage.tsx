import { SignUp } from '@clerk/react'

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center h-screen">
      <SignUp routing="path" path="/sign-up" />
    </div>
  )
}