import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/images/sorsu-logo.png"
              alt="SorSU Logo"
              width={48}
              height={48}
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
            />
            <div>
              <h1 className="text-lg font-bold text-gray-900 sm:text-xl font-playfair">SorSU Document System</h1>
              <p className="text-[10px] text-gray-500 font-medium tracking-wide uppercase sm:text-xs font-inter">
                Sorsogon State University
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-gray-600 hover:text-sorsuMaroon transition-colors hidden sm:block font-inter"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-sorsuMaroon px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-maroon-900 hover:shadow-lg hover:ring-2 hover:ring-maroon-500/50 active:scale-95 hover-lift font-inter"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-32 bg-gradient-to-br from-white via-gray-50 to-white">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-6 flex justify-center">
                <div className="relative w-32 h-32 sm:w-32 sm:h-32">
                  <Image
                    src="/images/sorsu-logo.png"
                    alt="SorSU Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl mb-6 font-playfair gradient-text text-shadow-lg">
                SorSU Document Request System
              </h1>
              <p className="text-lg leading-8 text-gray-600 mb-10 font-inter max-w-2xl mx-auto">
                Skip the long lines. Request your Transcript of Records, Diploma, and other certifications from anywhere, anytime. Secure, fast, and convenient.
              </p>
              <div className="flex items-center justify-center gap-x-6">
                <Link
                  href="/register"
                  className="rounded-lg bg-gradient-to-r from-sorsuMaroon to-maroon-900 px-8 py-4 text-sm font-semibold text-white shadow-lg hover:from-maroon-900 hover:to-sorsuMaroon hover:shadow-xl hover:ring-2 hover:ring-maroon-500/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-500 transition-all flex items-center gap-3 hover-lift font-inter"
                >
                  Create Account <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="text-sm font-semibold leading-6 text-gray-600 hover:text-sorsuMaroon transition-colors font-inter">
                  Log in <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-gradient-to-b from-gray-50 to-white py-24 sm:py-32 transition-colors">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-base font-semibold leading-7 text-sorsuMaroon uppercase tracking-wide font-inter">Mission, Vision & Values</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl font-playfair text-shadow">
                Sorsogon State University
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600 font-inter max-w-2xl mx-auto">
                Committed to excellence in education, research, and community service.
              </p>
            </div>
            <div className="mx-auto max-w-2xl lg:max-w-none">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Mission */}
                <div className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-md hover-lift">
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-sorsuMaroon">
                    <div className="h-6 w-6 bg-white rounded-full flex items-center justify-center">
                      <span className="text-sorsuMaroon font-bold text-xs font-inter">M</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold leading-8 text-gray-900 font-playfair">Mission</h3>
                  <p className="mt-2 flex-auto text-base leading-7 text-gray-600 font-inter">
                    To provide research-based quality education, innovations, and collaborative extension services for sustainable national and international development.
                  </p>
                </div>

                {/* Vision */}
                <div className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-md hover-lift">
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-sorsuMaroon">
                    <div className="h-6 w-6 bg-white rounded-full flex items-center justify-center">
                      <span className="text-sorsuMaroon font-bold text-xs font-inter">V</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold leading-8 text-gray-900 font-playfair">Vision</h3>
                  <p className="mt-2 flex-auto text-base leading-7 text-gray-600 font-inter">
                    A research university with a culture of excellence in developing globally competitive and values-oriented leaders and professionals.
                  </p>
                </div>

                {/* Core Values */}
                <div className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-md hover-lift">
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-sorsuMaroon">
                    <div className="h-6 w-6 bg-white rounded-full flex items-center justify-center">
                      <span className="text-sorsuMaroon font-bold text-xs font-inter">HEART</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold leading-8 text-gray-900 font-playfair">Core Values</h3>
                  <p className="mt-2 flex-auto text-base leading-7 text-gray-600 font-inter">
                    <strong className="text-sorsuMaroon">H</strong> - Humility<br/>
                    <strong className="text-sorsuMaroon">E</strong> - Excellence<br/>
                    <strong className="text-sorsuMaroon">A</strong> - Accountability<br/>
                    <strong className="text-sorsuMaroon">R</strong> - Resiliency<br/>
                    <strong className="text-sorsuMaroon">T</strong> - Trustworthiness
                  </p>
                </div>

                {/* Quality Policy */}
                <div className="flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 transition-all hover:shadow-md hover-lift">
                  <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-sorsuMaroon">
                    <div className="h-6 w-6 bg-white rounded-full flex items-center justify-center">
                      <span className="text-sorsuMaroon font-bold text-xs font-inter">QP</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold leading-8 text-gray-900 font-playfair">Quality Policy Statement</h3>
                  <p className="mt-2 flex-auto text-base leading-7 text-gray-600 font-inter">
                    The Sorsogon State University commits to deliver quality education anchored on its vision and mission for the development and growth of the community. SorSU shall transform knowledge through research, instruction, extension, and production as it adheres to statutory and regulatory requirements for continual improvement of its systems.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 transition-colors">
        <div className="mx-auto max-w-7xl px-6 py-12 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
            <span className="text-sm text-gray-500">
              Registrar&apos;s Office • Sorsogon State University
            </span>
          </div>
          <div className="mt-8 md:order-1 md:mt-0">
            <p className="text-center text-xs leading-5 text-gray-500">
              &copy; {new Date().getFullYear()} SorSU Document Request System. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
