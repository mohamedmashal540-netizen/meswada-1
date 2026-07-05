import { SignIn } from '@clerk/react'

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center h-screen">
      <SignIn routing="path" path="/sign-in" />
    </div>
  )
}