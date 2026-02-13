"use client";

import { Component, type ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
          <Card className="max-w-md border-zinc-700/80 bg-zinc-900/70">
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-lg font-semibold text-zinc-100">Something went wrong</h2>
              <p className="text-sm text-zinc-400">
                The app hit an unexpected error. Try refreshing the page.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
              >
                Refresh page
              </button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
