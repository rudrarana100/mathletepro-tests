import { UpdatePasswordForm } from "@/components/update-password-form";

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6 bg-black text-zinc-100 font-sans">
      <div className="w-full max-w-md">
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
