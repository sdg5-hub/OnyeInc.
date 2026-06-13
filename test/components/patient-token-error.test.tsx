// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PatientTokenError } from "@/components/patient-token-error";

describe("PatientTokenError", () => {
  it("renders the shared branded patient error layout", () => {
    render(
      <PatientTokenError
        title="Link expired"
        message="This link has expired. Please contact Onye Imaging to request a new link."
        supportHref="mailto:help@example.com"
      />,
    );

    expect(screen.getByText("OnyeSync")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Link expired" })).toBeInTheDocument();
    expect(screen.getByText("This link has expired. Please contact Onye Imaging to request a new link.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "mailto:help@example.com");
  });

  it("uses mobile-safe layout classes", () => {
    render(<PatientTokenError title="Invalid link" message="This link is invalid or has already been used." />);

    const main = screen.getByRole("main");
    expect(main).toHaveClass("min-h-screen", "w-full", "px-5");
  });
});
