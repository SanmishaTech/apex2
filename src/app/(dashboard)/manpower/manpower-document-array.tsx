"use client";

import { Fragment } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, FilePlus2, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import Image from "next/image";

interface ManpowerDocumentUploadArrayProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
}

export function ManpowerDocumentUploadArray({ control }: ManpowerDocumentUploadArrayProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "manpowerDocuments",
    keyName: "fieldId",
  });

  const createEmptyDocument = () => ({ id: undefined, documentName: "", documentUrl: null });

  const isImage = (name: string) => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name);

  return (
    <div className="space-y-4">
      {fields.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            No manpower documents uploaded yet.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 sm:w-auto"
            onClick={() => append(createEmptyDocument())}
          >
            <FilePlus2 className="h-4 w-4" />
            Add Document
          </Button>
        </div>
      )}

      {fields.map((field, index) => (
        <Fragment key={(field as Record<string, unknown>).fieldId as string ?? index}>
          <Controller
            control={control}
            name={`manpowerDocuments.${index}.id`}
            render={({ field: hiddenField }) => <input type="hidden" {...hiddenField} />}
          />

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-lg sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Document {index + 1}</p>
                  <p className="text-sm text-muted-foreground">Provide a short name and upload the supporting file.</p>
                </div>
              </div>

              <Controller
                control={control}
                name={`manpowerDocuments.${index}.documentName`}
                render={({ field: nameField, fieldState }) => (
                  <div className="flex-1 md:pl-6">
                    <Label className="text-sm font-semibold">
                      Document Name<span className="text-destructive">*</span>
                    </Label>
                    <input
                      {...nameField}
                      type="text"
                      placeholder="e.g. ID Proof, Bank Passbook"
                      className="mt-2 w-full rounded-lg border border-muted bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    />
                    {fieldState.error?.message && (
                      <p className="mt-1 text-xs text-destructive">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-stretch justify-center text-destructive hover:bg-destructive/10 sm:self-start sm:w-auto"
                onClick={() => remove(index)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            </div>

            <Controller
              control={control}
              name={`manpowerDocuments.${index}.documentUrl`}
              render={({ field: fileField, fieldState }) => {
                const value = fileField.value;
                const hasExistingFile = typeof value === "string" && value.trim() !== "";
                const isFileObject = value && typeof value !== "string" && value.name;
                const sizeLabel = isFileObject && typeof value.size === "number" ? `${Math.round(value.size / 1024)} KB` : undefined;
                const inputId = `manpower-doc-${index}`;

                return (
                  <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">
                        File<span className="text-destructive">*</span>
                      </Label>
                      <label
                        htmlFor={inputId}
                        className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-muted bg-background px-4 py-3 text-sm shadow-sm transition hover:border-primary hover:bg-primary/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {isFileObject ? value.name : "Click to select a file"}
                            </p>
                            <p className="text-xs text-muted-foreground">JPG, PNG, PDF up to 20 MB.</p>
                          </div>
                        </div>
                        <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary transition group-hover:border-primary group-hover:bg-primary/10">
                          Browse
                        </span>
                      </label>
                      <input
                        id={inputId}
                        type="file"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          fileField.onChange(file);
                        }}
                      />

                      {fieldState.error?.message && (
                        <p className="text-xs text-destructive">{fieldState.error.message}</p>
                      )}

                      {isFileObject && (
                        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-muted bg-muted/30 p-3 text-sm">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          <div className="min-w-0 flex-1 truncate">
                            <p className="truncate font-medium">{value.name}</p>
                            {sizeLabel && <p className="text-xs text-muted-foreground">{sizeLabel}</p>}
                          </div>
                        </div>
                      )}
                    </div>

                    {hasExistingFile && (
                      <div className="flex w-full flex-col gap-3 rounded-xl border border-muted bg-muted/20 p-4 md:max-w-sm md:flex-row md:items-center">
                        {isImage(value) ? (
                          <div className="relative h-20 w-20">
                            <Image
                              src={value.startsWith("http") ? value : `/api${value}`}
                              alt="Document preview"
                              fill
                              className="rounded-lg object-cover"
                              sizes="80px"
                            />
                          </div>
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
                            <FileText className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{value.split("/").pop()}</p>
                          <p className="text-xs text-muted-foreground">Existing upload</p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full justify-center md:w-auto"
                          onClick={() => {
                            const url = value.startsWith("http") ? value : `/api${value}`;
                            window.open(url, "_blank");
                          }}
                        >
                          View
                        </Button>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </div>
        </Fragment>
      ))}

      {fields.length > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="inline-flex w-full items-center justify-center gap-2 sm:w-auto sm:justify-start"
            onClick={() => append(createEmptyDocument())}
          >
            <Upload className="h-4 w-4" />
            Add another document
          </Button>
        </div>
      )}
    </div>
  );
}
