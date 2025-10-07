"use client";

import { DailyProgressForm } from "../daily-progress-form";
import { useProtectPage } from "@/hooks/use-protect-page";

export default function NewBoqPage() {
  // Guard based on PAGE_ACCESS_RULES for '/daily-progresses/new'
  useProtectPage();

  return (
    <DailyProgressForm mode="create" redirectOnSuccess="/daily-progresses" />
  );
}
