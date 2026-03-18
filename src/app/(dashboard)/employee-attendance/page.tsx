"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import { MapPin, Camera, Save } from "lucide-react";
import { useRef } from "react";

import { AppCard } from "@/components/common/app-card";
import { AppButton } from "@/components/common/app-button";
import { AppSelect } from "@/components/common/app-select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { apiGet, apiUpload } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";

type SiteDropdownItem = { id: number; site: string; shortName?: string | null };
type SitesApiResponse = { data: Array<SiteDropdownItem>; meta?: unknown };

export default function EmployeeAttendancePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mobileCaptureInputRef = useRef<HTMLInputElement | null>(null);

  const [siteId, setSiteId] = useState<string>("");
  const [attendanceType, setAttendanceType] = useState<"IN" | "OUT" | "">("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sitesQuery = useMemo(() => "/api/employee-attendances/my-sites", []);

  const { data: sitesData, isLoading: sitesLoading } = useSWR<SitesApiResponse>(
    sitesQuery,
    apiGet
  );

  useEffect(() => {
    try {
      const t = window.sessionStorage.getItem("employee_attendance_type");
      if (t === "IN" || t === "OUT") {
        setAttendanceType(t);
      } else {
        setAttendanceType("");
      }
    } catch {
      setAttendanceType("");
    }
  }, []);

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(ua));
  }, []);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    if (videoRef.current) {
      (videoRef.current as any).srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    setImageFile(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not supported in this browser/device");
      return;
    }

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        setCameraError("Camera preview failed");
        return;
      }

      (video as any).srcObject = stream;
      await video.play();
      setCameraReady(true);
    } catch (e: any) {
      console.error(e);
      const name = e?.name as string | undefined;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraError("Camera permission denied");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCameraError("No camera/webcam found on this device");
      } else {
        setCameraError("Failed to start camera");
      }
      stopCamera();
    }
  }, [stopCamera]);

  useEffect(() => {
    const url = imageFile ? URL.createObjectURL(imageFile) : null;
    setPreviewUrl(url);

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const getLocation = async (): Promise<
    { latitude: number; longitude: number; accuracy: number | null }
    | null
  > => {
    setGeoError(null);

    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation is not supported in this browser");
      return null;
    }

    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = Number.isFinite(pos.coords.accuracy)
            ? pos.coords.accuracy
            : null;
          setLatitude(lat);
          setLongitude(lng);
          setAccuracy(acc);
          resolve({ latitude: lat, longitude: lng, accuracy: acc });
        },
        (err) => {
          const msg =
            err.code === 1
              ? "Location permission denied. Please enable GPS/location access and try again."
              : err.code === 2
                ? "Location unavailable. Please turn on GPS and try again."
                : "Location request timed out";
          setGeoError(msg);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 25000,
          maximumAge: 0,
        }
      );
    });
  };

  const captureImage = async () => {
    setGeoError(null);

    if (!cameraReady) {
      toast.error("Camera is not ready");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      toast.error("Capture failed");
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Capture failed");
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);

    const loc = await getLocation();
    if (!loc) {
      toast.error("Location is required to mark attendance");
      return;
    }

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );
    if (!blob) {
      toast.error("Failed to capture image");
      return;
    }

    const file = new File([blob], `attendance-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    setImageFile(file);
  };

  const openCamera = async () => {
    setCameraError(null);
    if (isMobile) {
      mobileCaptureInputRef.current?.click();
      return;
    }
    setShowWebcam(true);
    await startCamera();
  };

  const closeWebcam = () => {
    setShowWebcam(false);
    stopCamera();
  };

  const handleMobileCaptureChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0] || null;
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Invalid image");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large (max 10MB)");
      return;
    }

    const loc = await getLocation();
    if (!loc) {
      toast.error("Location is required to mark attendance");
      return;
    }

    setImageFile(file);
  };

  const doSubmitAttendance = async () => {
    if (!attendanceType) {
      toast.error("Please start from Dashboard (Office In/Out)");
      return;
    }

    if (!siteId) {
      toast.error("Please select a site");
      return;
    }

    if (!imageFile) {
      toast.error("Please capture an image");
      return;
    }

    if (latitude === null || longitude === null) {
      toast.error("Location is required to mark attendance");
      return;
    }

    if (accuracy === null) {
      toast.error("Location accuracy is required to mark attendance");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("siteId", siteId);
      form.append("type", attendanceType);
      form.append("image", imageFile);
      form.append("latitude", String(latitude));
      form.append("longitude", String(longitude));
      form.append("accuracy", String(accuracy));

      await apiUpload("/api/employee-attendances", form, { timeoutMs: 60000 });
      try {
        window.sessionStorage.setItem(
          "employee_attendance_toast",
          attendanceType === "IN"
            ? "Office IN marked successfully"
            : "Office OUT marked successfully"
        );
      } catch {
        // ignore
      }

      setImageFile(null);
      router.push("/dashboard");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to mark attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const submitAttendance = async () => {
    if (!attendanceType) {
      toast.error("Please start from Dashboard (Office In/Out)");
      return;
    }

    if (!siteId) {
      toast.error("Please select a site");
      return;
    }

    if (!imageFile) {
      toast.error("Please capture an image");
      return;
    }

    if (latitude === null || longitude === null) {
      toast.error("Location is required to mark attendance");
      return;
    }

    if (accuracy === null) {
      toast.error("Location accuracy is required to mark attendance");
      return;
    }

    setConfirmOpen(true);
  };

  const sites = sitesData?.data || [];

  return (
    <AppCard>
      <AppCard.Header>
        <AppCard.Title className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Employee Attendance
        </AppCard.Title>
        <AppCard.Description>
          Mark attendance by capturing an image from browser and saving location.
        </AppCard.Description>
      </AppCard.Header>

      <AppCard.Content>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Site</label>
                <div className="mt-1">
                  <AppSelect
                    value={siteId || "__select"}
                    onValueChange={(v) => setSiteId(v === "__select" ? "" : v)}
                    placeholder={sitesLoading ? "Loading..." : "Select site"}
                  >
                    <AppSelect.Item value="__select">Select site</AppSelect.Item>
                    {sites.map((s) => (
                      <AppSelect.Item key={s.id} value={String(s.id)}>
                        {s.shortName ? `${s.shortName} - ${s.site}` : s.site}
                      </AppSelect.Item>
                    ))}
                  </AppSelect>
                </div>
              </div>
            </div>

            {geoError && (
              <div className="text-sm text-red-600">{geoError}</div>
            )}

            <div className="p-4 rounded-lg border border-border space-y-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                <span className="text-sm font-medium">Camera</span>
              </div>

              <input
                ref={mobileCaptureInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleMobileCaptureChange}
                className="hidden"
              />

              {cameraError && <div className="text-sm text-red-600">{cameraError}</div>}

              <div className="flex items-center justify-between gap-2">
                <AppButton size="sm" onClick={() => void openCamera()}>
                  Open Camera
                </AppButton>
                {!isMobile && (
                  <AppButton
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setImageFile(null);
                      setLatitude(null);
                      setLongitude(null);
                      setAccuracy(null);
                      setGeoError(null);
                    }}
                  >
                    Reset
                  </AppButton>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                {isMobile
                  ? "This will open your device camera. Attendance requires clicking a new picture."
                  : "This will open your webcam capture. Attendance requires a live camera/webcam."}
              </div>
            </div>

            <div className="flex justify-end">
              <AppButton
                onClick={submitAttendance}
                isLoading={submitting}
                className="w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Attendance
              </AppButton>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-border">
              <div className="text-sm font-medium mb-3">Preview</div>

              {previewUrl ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                  <Image
                    src={previewUrl}
                    alt="Captured"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-full aspect-video rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
                  No image selected
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />
            </div>

            {!isMobile && showWebcam && (
              <div className="p-4 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Webcam Capture</div>
                  <AppButton size="sm" variant="outline" onClick={closeWebcam}>
                    Close
                  </AppButton>
                </div>

                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <AppButton size="sm" onClick={() => void captureImage()} disabled={!cameraReady}>
                    Capture
                  </AppButton>
                </div>
              </div>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Confirm attendance?"
          description="This action cannot be reversed. Do you want to continue?"
          confirmText={submitting ? "Saving..." : "Yes, mark attendance"}
          cancelText="Cancel"
          disabled={submitting}
          confirmButtonClassName="bg-emerald-600 hover:bg-emerald-700 text-white"
          onConfirm={doSubmitAttendance}
        />
      </AppCard.Content>
    </AppCard>
  );
}
