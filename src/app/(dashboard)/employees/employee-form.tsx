"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton } from "@/components/common";
import { AppCard } from "@/components/common/app-card";
// DateInput component not available yet, using TextInput for resign date
import { apiPost, apiPatch, apiGet } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import useSWR from "swr";
import dynamic from "next/dynamic";
import type { DepartmentsResponse } from "@/types/departments";
import type { SitesResponse } from "@/types/sites";
import type { StatesResponse } from "@/types/states";
import type { CitiesResponse } from "@/types/cities";
import { ROLES } from "@/config/roles";

// Code-split tabs
const EmployeeDetailsTab = dynamic(() => import("./tabs/EmployeeDetailsTab"));
import PersonalDetailsTab from "./tabs/PersonalDetailsTab";
import LeaveDetailsTab from "./tabs/LeaveDetailsTab";
import TravelDetailsTab from "./tabs/TravelDetailsTab";
import ReportingSitesTab from "./tabs/ReportingSitesTab";

export interface EmployeeFormInitialData {
  id?: number;
  name?: string;
  departmentId?: number | null;
  resignDate?: string | null;
  // Personal Details
  dateOfBirth?: string | null;
  anniversaryDate?: string | null;
  spouseName?: string | null;
  bloodGroup?: string | null;
  // Address Details
  addressLine1?: string | null;
  addressLine2?: string | null;
  stateId?: number | null;
  cityId?: number | null;
  pincode?: string | null;
  // Contact Details
  mobile1?: string | null;
  mobile2?: string | null;
  // Other Details
  esic?: string | null;
  pf?: string | null;
  panNo?: string | null;
  adharNo?: string | null;
  cinNo?: string | null;
  // Travel/Reporting Details
  airTravelClass?: string | null;
  railwayTravelClass?: string | null;
  busTravelClass?: string | null;
  reporting1Id?: number | null;
  reporting2Id?: number | null;
  // Reporting Sites
  reportingSiteId?: number | null;
  reportingSiteAssignedDate?: string | null;
  // Signature and Profile Picture
  signatureImage?: string | null;
  employeeImage?: string | null;
  employeeDocuments?: Array<{
    id?: number;
    documentName: string | null;
    documentUrl: string | null;
  }>;
  // Site Employees (for edit mode)
  siteEmployees?: Array<{
    id: number;
    siteId: number;
    assignedDate: Date;
    site: {
      id: number;
      site: string;
    };
  }>;
  // Relations
  department?: {
    id: number;
    department: string;
  } | null;
  state?: {
    id: number;
    state: string;
  } | null;
  city?: {
    id: number;
    city: string;
  } | null;
  // User Account Details
  email?: string;
  password?: string;
}

export interface EmployeeFormProps {
  mode: "create" | "edit";
  initial?: EmployeeFormInitialData | null;
  onSuccess?: (result?: unknown) => void;
  redirectOnSuccess?: string; // default '/employees'
}

const ROLE_VALUES = Object.values(ROLES) as [string, ...string[]];

const documentSchema = z.object({
  id: z.number().optional(),
  documentName: z.string().min(1, "Document name is required"),
  documentUrl: z
    .any()
    .refine(
      (val) =>
        (typeof val === "string" && val.trim() !== "") ||
        val instanceof File,
      "Document file is required"
    ),
});

const createInputSchema = z
  .object({
    name: z.string().min(1, "Employee name is required"),
    departmentId: z.string().optional(),
    resignDate: z.string().optional(),
    // Personal Details
    dateOfBirth: z.string().optional(),
    anniversaryDate: z.string().optional(),
    spouseName: z.string().optional(),
    bloodGroup: z.string().optional(),
    // Address Details
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    stateId: z.string().optional(),
    cityId: z.string().optional(),
    pincode: z.string().optional(),
    // Contact Details
    mobile1: z.string().optional(),
    mobile2: z.string().optional(),
    // Other Details
    esic: z.string().optional(),
    pf: z.string().optional(),
    panNo: z.string().optional(),
    adharNo: z.string().optional(),
    cinNo: z.string().optional(),
    // Travel/Reporting Details
    airTravelClass: z.string().optional(),
    railwayTravelClass: z.string().optional(),
    busTravelClass: z.string().optional(),
    reporting1Id: z.string().optional(),
    reporting2Id: z.string().optional(),
    // Reporting Sites
    reportingSiteId: z.string().optional(),
    reportingSiteAssignedDate: z.string().optional(),
    // Leave Details
    sickLeavesPerYear: z.string().optional(),
    paidLeavesPerYear: z.string().optional(),
    casualLeavesPerYear: z.string().optional(),
    balanceSickLeaves: z.string().optional(),
    balancePaidLeaves: z.string().optional(),
    balanceCasualLeaves: z.string().optional(),
    // User Account Details (required for new employees)
    email: z.string().email("Valid email is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z
      .string()
      .min(6, "Confirm password must be at least 6 characters"),
    role: z.enum(ROLE_VALUES).default(ROLES.USER),
    employeeDocuments: z.array(documentSchema).default([]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const editInputSchema = z.object({
  name: z.string().min(1, "Employee name is required"),
  departmentId: z.string().optional(),
  resignDate: z.string().optional(),
  // Personal Details
  dateOfBirth: z.string().optional(),
  anniversaryDate: z.string().optional(),
  spouseName: z.string().optional(),
  bloodGroup: z.string().optional(),
  // Address Details
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  stateId: z.string().optional(),
  cityId: z.string().optional(),
  pincode: z.string().optional(),
  // Contact Details
  mobile1: z.string().optional(),
  mobile2: z.string().optional(),
  // Other Details
  esic: z.string().optional(),
  pf: z.string().optional(),
  panNo: z.string().optional(),
  adharNo: z.string().optional(),
  cinNo: z.string().optional(),
  // Travel/Reporting Details
  airTravelClass: z.string().optional(),
  railwayTravelClass: z.string().optional(),
  busTravelClass: z.string().optional(),
  reporting1Id: z.string().optional(),
  reporting2Id: z.string().optional(),
  // Reporting Sites
  reportingSiteId: z.string().optional(),
  reportingSiteAssignedDate: z.string().optional(),
  // Leave Details
  sickLeavesPerYear: z.string().optional(),
  paidLeavesPerYear: z.string().optional(),
  casualLeavesPerYear: z.string().optional(),
  balanceSickLeaves: z.string().optional(),
  balancePaidLeaves: z.string().optional(),
  balanceCasualLeaves: z.string().optional(),
  employeeDocuments: z.array(documentSchema).default([]),
});

const createSchema = createInputSchema.transform((data) => ({
  ...data,
  departmentId:
    data.departmentId && data.departmentId !== ""
      ? parseInt(data.departmentId)
      : null,
  stateId: data.stateId && data.stateId !== "" ? parseInt(data.stateId) : null,
  cityId: data.cityId && data.cityId !== "" ? parseInt(data.cityId) : null,
  resignDate:
    data.resignDate && data.resignDate !== ""
      ? new Date(data.resignDate)
      : null,
  dateOfBirth:
    data.dateOfBirth && data.dateOfBirth !== ""
      ? new Date(data.dateOfBirth)
      : null,
  anniversaryDate:
    data.anniversaryDate && data.anniversaryDate !== ""
      ? new Date(data.anniversaryDate)
      : null,
  // Travel/Reporting Details
  reporting1Id:
    data.reporting1Id && data.reporting1Id !== ""
      ? parseInt(data.reporting1Id)
      : null,
  reporting2Id:
    data.reporting2Id && data.reporting2Id !== ""
      ? parseInt(data.reporting2Id)
      : null,
  // Reporting Sites
  reportingSiteId:
    data.reportingSiteId && data.reportingSiteId !== ""
      ? parseInt(data.reportingSiteId)
      : null,
  reportingSiteAssignedDate:
    data.reportingSiteAssignedDate && data.reportingSiteAssignedDate !== ""
      ? new Date(data.reportingSiteAssignedDate)
      : null,
  // Leave Details - convert to numbers
  sickLeavesPerYear:
    data.sickLeavesPerYear && data.sickLeavesPerYear !== ""
      ? parseInt(data.sickLeavesPerYear)
      : null,
  paidLeavesPerYear:
    data.paidLeavesPerYear && data.paidLeavesPerYear !== ""
      ? parseInt(data.paidLeavesPerYear)
      : null,
  casualLeavesPerYear:
    data.casualLeavesPerYear && data.casualLeavesPerYear !== ""
      ? parseInt(data.casualLeavesPerYear)
      : null,
  balanceSickLeaves:
    data.balanceSickLeaves && data.balanceSickLeaves !== ""
      ? parseInt(data.balanceSickLeaves)
      : null,
  balancePaidLeaves:
    data.balancePaidLeaves && data.balancePaidLeaves !== ""
      ? parseInt(data.balancePaidLeaves)
      : null,
  balanceCasualLeaves:
    data.balanceCasualLeaves && data.balanceCasualLeaves !== ""
      ? parseInt(data.balanceCasualLeaves)
      : null,
}));

const editSchema = editInputSchema.transform((data) => ({
  ...data,
  departmentId:
    data.departmentId && data.departmentId !== ""
      ? parseInt(data.departmentId)
      : null,
  stateId: data.stateId && data.stateId !== "" ? parseInt(data.stateId) : null,
  cityId: data.cityId && data.cityId !== "" ? parseInt(data.cityId) : null,
  resignDate:
    data.resignDate && data.resignDate !== ""
      ? new Date(data.resignDate)
      : null,
  dateOfBirth:
    data.dateOfBirth && data.dateOfBirth !== ""
      ? new Date(data.dateOfBirth)
      : null,
  anniversaryDate:
    data.anniversaryDate && data.anniversaryDate !== ""
      ? new Date(data.anniversaryDate)
      : null,
  // Travel/Reporting Details
  reporting1Id:
    data.reporting1Id && data.reporting1Id !== ""
      ? parseInt(data.reporting1Id)
      : null,
  reporting2Id:
    data.reporting2Id && data.reporting2Id !== ""
      ? parseInt(data.reporting2Id)
      : null,
  // Reporting Sites
  reportingSiteId:
    data.reportingSiteId && data.reportingSiteId !== ""
      ? parseInt(data.reportingSiteId)
      : null,
  reportingSiteAssignedDate:
    data.reportingSiteAssignedDate && data.reportingSiteAssignedDate !== ""
      ? new Date(data.reportingSiteAssignedDate)
      : null,
  // Leave Details - convert to numbers
  sickLeavesPerYear:
    data.sickLeavesPerYear && data.sickLeavesPerYear !== ""
      ? parseInt(data.sickLeavesPerYear)
      : null,
  paidLeavesPerYear:
    data.paidLeavesPerYear && data.paidLeavesPerYear !== ""
      ? parseInt(data.paidLeavesPerYear)
      : null,
  casualLeavesPerYear:
    data.casualLeavesPerYear && data.casualLeavesPerYear !== ""
      ? parseInt(data.casualLeavesPerYear)
      : null,
  balanceSickLeaves:
    data.balanceSickLeaves && data.balanceSickLeaves !== ""
      ? parseInt(data.balanceSickLeaves)
      : null,
  balancePaidLeaves:
    data.balancePaidLeaves && data.balancePaidLeaves !== ""
      ? parseInt(data.balancePaidLeaves)
      : null,
  balanceCasualLeaves:
    data.balanceCasualLeaves && data.balanceCasualLeaves !== ""
      ? parseInt(data.balanceCasualLeaves)
      : null,
}));

type CreateFormValues = z.infer<typeof createInputSchema>;
type EditFormValues = z.infer<typeof editInputSchema>;
type FormValues = CreateFormValues | EditFormValues;

export function EmployeeForm({
  mode,
  initial,
  onSuccess,
  redirectOnSuccess = "/employees",
}: EmployeeFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | undefined>(
    initial?.signatureImage || undefined
  );
  const [profilePicUrl, setProfilePicUrl] = useState<string | undefined>(
    initial?.employeeImage || undefined
  );
  const { backWithScrollRestore } = useScrollRestoration("employees-list");

  const initialDocumentValues =
    initial?.employeeDocuments?.map((doc) => ({
      id: doc.id,
      documentName: doc.documentName ?? "",
      documentUrl: doc.documentUrl ?? "",
    })) ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(mode === "create" ? createSchema : editSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      name: initial?.name || "",
      departmentId: initial?.departmentId ? String(initial.departmentId) : "",
      // siteId: [],
      resignDate: initial?.resignDate ? initial.resignDate.split("T")[0] : "",
      // Personal Details
      dateOfBirth: initial?.dateOfBirth
        ? initial.dateOfBirth.split("T")[0]
        : "",
      anniversaryDate: initial?.anniversaryDate
        ? initial.anniversaryDate.split("T")[0]
        : "",
      spouseName: initial?.spouseName || "",
      bloodGroup: initial?.bloodGroup || "",
      // Address Details
      addressLine1: initial?.addressLine1 || "",
      addressLine2: initial?.addressLine2 || "",
      stateId: initial?.stateId ? String(initial.stateId) : "",
      cityId: initial?.cityId ? String(initial.cityId) : "",
      pincode: initial?.pincode || "",
      // Contact Details
      mobile1: initial?.mobile1 || "",
      mobile2: initial?.mobile2 || "",
      // Other Details
      esic: initial?.esic || "",
      pf: initial?.pf || "",
      panNo: initial?.panNo || "",
      adharNo: initial?.adharNo || "",
      cinNo: initial?.cinNo || "",
      // Travel/Reporting Details
      airTravelClass: initial?.airTravelClass || "",
      railwayTravelClass: initial?.railwayTravelClass || "",
      busTravelClass: initial?.busTravelClass || "",
      reporting1Id: initial?.reporting1Id ? String(initial.reporting1Id) : "",
      reporting2Id: initial?.reporting2Id ? String(initial.reporting2Id) : "",
      // Reporting Sites
      reportingSiteId: initial?.reportingSiteId
        ? String(initial.reportingSiteId)
        : "",
      reportingSiteAssignedDate: initial?.reportingSiteAssignedDate
        ? initial.reportingSiteAssignedDate.split("T")[0]
        : "",
      // Leave Details
      sickLeavesPerYear: "",
      paidLeavesPerYear: "",
      casualLeavesPerYear: "",
      balanceSickLeaves: "",
      balancePaidLeaves: "",
      balanceCasualLeaves: "",
      // User Account Details
      email: initial?.email || "",
      password: "",
      confirmPassword: "",
      role: "user",
      employeeDocuments: initialDocumentValues,
    },
  });

  useEffect(() => {
    if (mode === "edit" && initial) {
      setSignatureUrl(initial.signatureImage || undefined);
      setProfilePicUrl(initial.employeeImage || undefined);

      form.reset(
        {
          ...form.getValues(),
          ...{
            name: initial.name || "",
            departmentId: initial.departmentId
              ? String(initial.departmentId)
              : "",
            resignDate: initial.resignDate
              ? initial.resignDate.split("T")[0]
              : "",
            dateOfBirth: initial.dateOfBirth
              ? initial.dateOfBirth.split("T")[0]
              : "",
            anniversaryDate: initial.anniversaryDate
              ? initial.anniversaryDate.split("T")[0]
              : "",
            spouseName: initial.spouseName || "",
            bloodGroup: initial.bloodGroup || "",
            addressLine1: initial.addressLine1 || "",
            addressLine2: initial.addressLine2 || "",
            stateId: initial.stateId ? String(initial.stateId) : "",
            cityId: initial.cityId ? String(initial.cityId) : "",
            pincode: initial.pincode || "",
            mobile1: initial.mobile1 || "",
            mobile2: initial.mobile2 || "",
            esic: initial.esic || "",
            pf: initial.pf || "",
            panNo: initial.panNo || "",
            adharNo: initial.adharNo || "",
            cinNo: initial.cinNo || "",
            airTravelClass: initial.airTravelClass || "",
            railwayTravelClass: initial.railwayTravelClass || "",
            busTravelClass: initial.busTravelClass || "",
            reporting1Id: initial.reporting1Id
              ? String(initial.reporting1Id)
              : "",
            reporting2Id: initial.reporting2Id
              ? String(initial.reporting2Id)
              : "",
            reportingSiteId: initial.reportingSiteId
              ? String(initial.reportingSiteId)
              : "",
            reportingSiteAssignedDate: initial.reportingSiteAssignedDate
              ? initial.reportingSiteAssignedDate.split("T")[0]
              : "",
            employeeDocuments:
              initial.employeeDocuments?.map((doc) => ({
                id: doc.id,
                documentName: doc.documentName ?? "",
                documentUrl: doc.documentUrl ?? "",
              })) ?? [],
          },
        },
        { keepDirty: false, keepTouched: false }
      );
    }
  }, [mode, initial]);

  const { control, handleSubmit, watch } = form;
  const isCreate = mode === "create";

  // Fetch departments for dropdown
  const { data: departmentsData } = useSWR<DepartmentsResponse>(
    "/api/departments?perPage=100",
    apiGet
  );

  // Fetch states for dropdown
  const { data: statesData } = useSWR<StatesResponse>(
    "/api/states?perPage=100",
    apiGet
  );

  // Fetch sites for dropdown
  const { data: sitesData } = useSWR<SitesResponse>(
    "/api/sites?perPage=100",
    apiGet
  );

  // Fetch cities for dropdown (filtered by selected state)
  const selectedStateId = watch("stateId");
  const { data: citiesData } = useSWR<CitiesResponse>(
    selectedStateId && selectedStateId !== ""
      ? `/api/cities?stateId=${selectedStateId}&perPage=100`
      : null,
    apiGet
  );

  // Fetch employees for reporting dropdowns
  const { data: employeesData } = useSWR<any>(
    "/api/employees?perPage=100",
    apiGet
  );

  async function onSubmit(formData: FormValues) {
    setSubmitting(true);
    try {
      let submitData: Record<string, unknown>;
      if (isCreate) {
        const data = formData as any; // Already transformed by zodResolver(createSchema)
        const documents = Array.isArray(data.employeeDocuments)
          ? data.employeeDocuments
          : [];
        const documentMetadata = documents.map((doc: any) => ({
          id: typeof doc.id === "number" ? doc.id : undefined,
          documentName: doc.documentName,
          documentUrl:
            typeof doc.documentUrl === "string" && doc.documentUrl.trim() !== ""
              ? doc.documentUrl
              : undefined,
        }));
        const hasDocumentFiles = documents.some(
          (doc: any) => doc?.documentUrl instanceof File
        );
        const shouldUseMultipart = Boolean(
          signatureFile || profilePicFile || hasDocumentFiles
        );

        if (shouldUseMultipart) {
          const fd = new FormData();
          fd.append("name", data.name);
          if (data.departmentId)
            fd.append("departmentId", String(data.departmentId));
          if (data.resignDate)
            fd.append("resignDate", data.resignDate.toISOString());
          if (data.dateOfBirth)
            fd.append("dateOfBirth", data.dateOfBirth.toISOString());
          if (data.anniversaryDate)
            fd.append("anniversaryDate", data.anniversaryDate.toISOString());
          if (data.spouseName) fd.append("spouseName", data.spouseName);
          if (data.bloodGroup) fd.append("bloodGroup", data.bloodGroup);
          if (data.addressLine1) fd.append("addressLine1", data.addressLine1);
          if (data.addressLine2) fd.append("addressLine2", data.addressLine2);
          if (data.stateId) fd.append("stateId", String(data.stateId));
          if (data.cityId) fd.append("cityId", String(data.cityId));
          if (data.pincode) fd.append("pincode", data.pincode);
          if (data.mobile1) fd.append("mobile1", data.mobile1);
          if (data.mobile2) fd.append("mobile2", data.mobile2);
          if (data.esic) fd.append("esic", data.esic);
          if (data.pf) fd.append("pf", data.pf);
          if (data.panNo) fd.append("panNo", data.panNo);
          if (data.adharNo) fd.append("adharNo", data.adharNo);
          if (data.cinNo) fd.append("cinNo", data.cinNo);
          // Travel/Reporting Details
          if (data.airTravelClass)
            fd.append("airTravelClass", data.airTravelClass);
          if (data.railwayTravelClass)
            fd.append("railwayTravelClass", data.railwayTravelClass);
          if (data.busTravelClass)
            fd.append("busTravelClass", data.busTravelClass);
          if (data.reporting1Id)
            fd.append("reporting1Id", String(data.reporting1Id));
          if (data.reporting2Id)
            fd.append("reporting2Id", String(data.reporting2Id));
          // Reporting Sites
          if (data.reportingSiteId)
            fd.append("reportingSiteId", String(data.reportingSiteId));
          if (data.reportingSiteAssignedDate)
            fd.append(
              "reportingSiteAssignedDate",
              data.reportingSiteAssignedDate.toISOString()
            );
          fd.append("email", data.email);
          fd.append("password", data.password);
          fd.append("role", data.role);
          if (profilePicFile) fd.append("profilePic", profilePicFile);
          if (signatureFile) fd.append("signature", signatureFile);
          fd.append("employeeDocuments", JSON.stringify(documentMetadata));
          documents.forEach((doc: any, idx: number) => {
            if (doc?.id) {
              fd.append(`employeeDocuments[${idx}][id]`, String(doc.id));
            }
            fd.append(
              `employeeDocuments[${idx}][documentName]`,
              doc?.documentName ?? ""
            );
            if (doc?.documentUrl instanceof File) {
              fd.append(
                `employeeDocuments[${idx}][documentFile]`,
                doc.documentUrl,
                doc.documentUrl.name
              );
            } else if (
              typeof doc?.documentUrl === "string" &&
              doc.documentUrl.trim() !== ""
            ) {
              fd.append(
                `employeeDocuments[${idx}][documentUrl]`,
                doc.documentUrl
              );
            }
          });

          const response = await fetch("/api/employees", {
            method: "POST",
            body: fd,
          });
          if (!response.ok) {
            const err = await response.json().catch(() => null);
            throw new Error(
              err?.message || `HTTP ${response.status}: Failed to save employee`
            );
          }
          const res = await response.json();
          toast.success("Employee created");
          onSuccess?.(res);
          router.push(redirectOnSuccess);
          return;
        }
        submitData = {
          name: data.name,
          departmentId: data.departmentId || undefined,
          resignDate: data.resignDate?.toISOString() || undefined,
          // Personal Details
          dateOfBirth: data.dateOfBirth?.toISOString() || undefined,
          anniversaryDate: data.anniversaryDate?.toISOString() || undefined,
          spouseName: data.spouseName || undefined,
          bloodGroup: data.bloodGroup || undefined,
          // Address Details
          addressLine1: data.addressLine1 || undefined,
          addressLine2: data.addressLine2 || undefined,
          stateId: data.stateId || undefined,
          cityId: data.cityId || undefined,
          pincode: data.pincode || undefined,
          // Contact Details
          mobile1: data.mobile1 || undefined,
          mobile2: data.mobile2 || undefined,
          // Other Details
          esic: data.esic || undefined,
          pf: data.pf || undefined,
          panNo: data.panNo || undefined,
          adharNo: data.adharNo || undefined,
          cinNo: data.cinNo || undefined,
          // Travel/Reporting Details
          airTravelClass: data.airTravelClass || undefined,
          railwayTravelClass: data.railwayTravelClass || undefined,
          busTravelClass: data.busTravelClass || undefined,
          reporting1Id: data.reporting1Id || undefined,
          reporting2Id: data.reporting2Id || undefined,
          // Reporting Sites
          reportingSiteId: data.reportingSiteId || undefined,
          reportingSiteAssignedDate:
            data.reportingSiteAssignedDate?.toISOString() || undefined,
          // User Account Details (creation only)
          email: data.email,
          password: data.password,
          role: data.role,
          employeeDocuments: documentMetadata,
        };
      } else {
        const data = formData as any; // Already transformed by zodResolver(editSchema)
        const documents = Array.isArray(data.employeeDocuments)
          ? data.employeeDocuments
          : [];
        const documentMetadata = documents.map((doc: any) => ({
          id: typeof doc.id === "number" ? doc.id : undefined,
          documentName: doc.documentName,
          documentUrl:
            typeof doc.documentUrl === "string" && doc.documentUrl.trim() !== ""
              ? doc.documentUrl
              : undefined,
        }));
        const hasDocumentFiles = documents.some(
          (doc: any) => doc?.documentUrl instanceof File
        );
        const shouldUseMultipart = Boolean(
          signatureFile || profilePicFile || hasDocumentFiles
        );
        // If either file is present, use FormData and send PATCH as multipart
        if (shouldUseMultipart) {
          const fd = new FormData();
          fd.append("name", data.name);
          if (data.departmentId)
            fd.append("departmentId", String(data.departmentId));
          if (data.siteId) {
            if (Array.isArray(data.siteId) && data.siteId.length > 0) {
              fd.append("siteId", JSON.stringify(data.siteId));
            } else {
              fd.append("siteId", String(data.siteId));
            }
          }
          if (data.resignDate)
            fd.append("resignDate", data.resignDate.toISOString());
          if (data.dateOfBirth)
            fd.append("dateOfBirth", data.dateOfBirth.toISOString());
          if (data.anniversaryDate)
            fd.append("anniversaryDate", data.anniversaryDate.toISOString());
          if (data.spouseName) fd.append("spouseName", data.spouseName);
          if (data.bloodGroup) fd.append("bloodGroup", data.bloodGroup);
          if (data.addressLine1) fd.append("addressLine1", data.addressLine1);
          if (data.addressLine2) fd.append("addressLine2", data.addressLine2);
          if (data.stateId) fd.append("stateId", String(data.stateId));
          if (data.cityId) fd.append("cityId", String(data.cityId));
          if (data.pincode) fd.append("pincode", data.pincode);
          if (data.mobile1) fd.append("mobile1", data.mobile1);
          if (data.mobile2) fd.append("mobile2", data.mobile2);
          if (data.esic) fd.append("esic", data.esic);
          if (data.pf) fd.append("pf", data.pf);
          if (data.panNo) fd.append("panNo", data.panNo);
          if (data.adharNo) fd.append("adharNo", data.adharNo);
          if (data.cinNo) fd.append("cinNo", data.cinNo);
          // Travel/Reporting Details
          if (data.airTravelClass)
            fd.append("airTravelClass", data.airTravelClass);
          if (data.railwayTravelClass)
            fd.append("railwayTravelClass", data.railwayTravelClass);
          if (data.busTravelClass)
            fd.append("busTravelClass", data.busTravelClass);
          if (data.reporting1Id)
            fd.append("reporting1Id", String(data.reporting1Id));
          if (data.reporting2Id)
            fd.append("reporting2Id", String(data.reporting2Id));
          // Reporting Sites
          if (data.reportingSiteId)
            fd.append("reportingSiteId", String(data.reportingSiteId));
          if (data.reportingSiteAssignedDate)
            fd.append(
              "reportingSiteAssignedDate",
              data.reportingSiteAssignedDate.toISOString()
            );
          if (profilePicFile) fd.append("profilePic", profilePicFile);
          if (signatureFile) fd.append("signature", signatureFile);
          fd.append("employeeDocuments", JSON.stringify(documentMetadata));
          documents.forEach((doc: any, idx: number) => {
            if (doc?.id) {
              fd.append(`employeeDocuments[${idx}][id]`, String(doc.id));
            }
            fd.append(
              `employeeDocuments[${idx}][documentName]`,
              doc?.documentName ?? ""
            );
            if (doc?.documentUrl instanceof File) {
              fd.append(
                `employeeDocuments[${idx}][documentFile]`,
                doc.documentUrl,
                doc.documentUrl.name
              );
            } else if (
              typeof doc?.documentUrl === "string" &&
              doc.documentUrl.trim() !== ""
            ) {
              fd.append(
                `employeeDocuments[${idx}][documentUrl]`,
                doc.documentUrl
              );
            }
          });

          // PATCH with multipart/form-data
          if (initial?.id) {
            const response = await fetch(`/api/employees/${initial.id}`, {
              method: "PATCH",
              body: fd,
            });
            if (!response.ok) {
              const err = await response.json().catch(() => null);
              throw new Error(
                err?.message ||
                  `HTTP ${response.status}: Failed to update employee`
              );
            }
            const res = await response.json();
            toast.success("Employee updated");
            onSuccess?.(res);
            router.push(redirectOnSuccess);
            return;
          }
        }
        submitData = {
          name: data.name,
          departmentId: data.departmentId || undefined,
          siteId: data.siteId || undefined,
          resignDate: data.resignDate?.toISOString() || undefined,
          // Personal Details
          dateOfBirth: data.dateOfBirth?.toISOString() || undefined,
          anniversaryDate: data.anniversaryDate?.toISOString() || undefined,
          spouseName: data.spouseName || undefined,
          bloodGroup: data.bloodGroup || undefined,
          // Address Details
          addressLine1: data.addressLine1 || undefined,
          addressLine2: data.addressLine2 || undefined,
          stateId: data.stateId || undefined,
          cityId: data.cityId || undefined,
          pincode: data.pincode || undefined,
          // Contact Details
          mobile1: data.mobile1 || undefined,
          mobile2: data.mobile2 || undefined,
          // Other Details
          esic: data.esic || undefined,
          pf: data.pf || undefined,
          panNo: data.panNo || undefined,
          adharNo: data.adharNo || undefined,
          cinNo: data.cinNo || undefined,
          // Travel/Reporting Details
          airTravelClass: data.airTravelClass || undefined,
          railwayTravelClass: data.railwayTravelClass || undefined,
          busTravelClass: data.busTravelClass || undefined,
          reporting1Id: data.reporting1Id || undefined,
          reporting2Id: data.reporting2Id || undefined,
          // Reporting Sites
          reportingSiteId: data.reportingSiteId || undefined,
          reportingSiteAssignedDate:
            data.reportingSiteAssignedDate?.toISOString() || undefined,
          employeeDocuments: documentMetadata,
        };
      }

      if (isCreate) {
        const res = await apiPost("/api/employees", submitData);
        toast.success("Employee created");
        onSuccess?.(res);
      } else if (initial?.id) {
        const res = await apiPatch(`/api/employees/${initial.id}`, submitData);
        toast.success("Employee updated");
        onSuccess?.(res);
      }
      router.push(redirectOnSuccess);
    } catch (err) {
      toast.error((err as Error).message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  const tabs = [
    { id: "details", label: "Employee Details", icon: "User" },
    { id: "personal", label: "Personal Details", icon: "UserCheck" },
    { id: "leave", label: "Leave Details", icon: "Calendar" },
    { id: "travel", label: "Travel Class", icon: "Plane" },
    { id: "reportingSites", label: "Reporting Sites", icon: "MapPin" },
  ];

  return (
    <Form {...form}>
      <AppCard>
        <AppCard.Header>
          <AppCard.Title>
            {isCreate ? "Create Employee" : "Edit Employee"}
          </AppCard.Title>
          <AppCard.Description>
            {isCreate
              ? "Add a new employee to the system."
              : "Update employee information."}
          </AppCard.Description>
        </AppCard.Header>

        {/* Tab Navigation */}
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }
                `}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <AppCard.Content>
            {/* Employee Details Tab */}
            {activeTab === "details" && (
              <EmployeeDetailsTab
                control={control}
                isCreate={isCreate}
                departmentsData={departmentsData}
                sitesData={sitesData}
                onSignatureChange={setSignatureFile}
                onProfilePicChange={setProfilePicFile}
                initialProfilePicUrl={profilePicUrl}
                initialSignatureUrl={signatureUrl}
              />
            )}

            {/* Personal Details Tab */}
            {activeTab === "personal" && (
              <PersonalDetailsTab
                control={control}
                statesData={statesData}
                citiesData={citiesData}
              />
            )}

            {/* Leave Details Tab */}
            {activeTab === "leave" && <LeaveDetailsTab control={control} />}

            {/* Travel Class Tab */}
            {activeTab === "travel" && (
              <TravelDetailsTab
                control={control}
                employeesData={employeesData}
              />
            )}

            {/* Reporting Sites Tab */}
            {activeTab === "reportingSites" && (
              <ReportingSitesTab control={control} sitesData={sitesData} />
            )}
          </AppCard.Content>

          <AppCard.Footer className="justify-end">
            <AppButton
              type="button"
              variant="secondary"
              onClick={backWithScrollRestore}
              disabled={submitting}
              iconName="X"
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              iconName={isCreate ? "Plus" : "Save"}
              isLoading={submitting}
              disabled={submitting || !form.formState.isValid}
            >
              {isCreate ? "Create Employee" : "Save Changes"}
            </AppButton>
          </AppCard.Footer>
        </form>
      </AppCard>
    </Form>
  );
}

export default EmployeeForm;
