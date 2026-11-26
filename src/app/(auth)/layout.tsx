import Link from "next/link";
import { Logo } from "@/components/logo";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] sm:justify-center">
      <Link href="/" className="mb-10"><Logo size="md" /></Link>
      <div className="w-full max-w-sm animate-fade-up">{children}</div>
    </main>
  );
}
