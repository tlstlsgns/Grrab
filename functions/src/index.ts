import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as admin from "firebase-admin";
import express, {NextFunction, Request, Response} from "express";
import fetch from "node-fetch";

// ─── Firebase Admin 초기화 ───────────────────────────────────────────────────
admin.initializeApp();

// ─── Secrets ─────────────────────────────────────────────────────────────────
const falApiKey = defineSecret("FAL_KEY");

// ─── 전역 옵션 ────────────────────────────────────────────────────────────────
setGlobalOptions({maxInstances: 10});

// ─── Express 앱 ───────────────────────────────────────────────────────────────
const app = express();

// CORS — 모든 origin 허용 (Chrome Extension 포함)
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({limit: "50mb"}));

// ─── 헬퍼: Firestore / Storage ────────────────────────────────────────────────
function getFirestore() {
  return admin.firestore();
}

function getStorage() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "";
  return bucketName ?
    admin.storage().bucket(bucketName) :
    admin.storage().bucket();
}

// ─── 헬퍼: extractSource ──────────────────────────────────────────────────────
const extractSource = (url: string): string => {
  try {
    if (!url || url.trim().length === 0) return "local";
    if (url.startsWith("data:")) return "local";
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith("www.")) hostname = hostname.substring(4);
    const parts = hostname.split(".");
    const subdomainPrefixes = ["blog", "m", "mobile", "www", "mail", "drive", "docs", "maps"];
    if (parts.length > 2 && subdomainPrefixes.includes(parts[0])) {
      return parts.slice(1, -1).join(".");
    }
    if (parts.length >= 2) return parts.slice(0, -1).join(".");
    return hostname;
  } catch {
    return "unknown";
  }
};

// ─── 헬퍼: uploadBase64ImageToStorage (screenshots + clips) ───────────────────
async function uploadBase64ImageToStorage(
  base64DataUrl: string,
  userId: string,
  itemId: string,
  prefix: string
): Promise<{ publicUrl: string } | null> {
  try {
    const matches = base64DataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const filePath = `${prefix}/${userId}/${itemId}.${ext}`;
    const bucket = getStorage();
    const file = bucket.file(filePath);
    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        // The object path is derived from the document id, so re-uploading for the same item
        // replaces it and the URL does not change. Without this, a client that already has the
        // old bytes keeps them until Google's default expiry — a re-clip at a different size
        // would look like it had not happened.
        cacheControl: "public, max-age=0, must-revalidate",
      },
    });
    try {
      await file.makePublic();
    } catch {/* ignore ACL errors */}
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    return {publicUrl};
  } catch {
    return null;
  }
}

async function uploadScreenshotToStorage(
  base64DataUrl: string,
  userId: string,
  itemId: string
): Promise<{ publicUrl: string } | null> {
  return uploadBase64ImageToStorage(base64DataUrl, userId, itemId, "screenshots");
}

async function uploadClipImageToStorage(
  base64DataUrl: string,
  userId: string,
  itemId: string
): Promise<{ publicUrl: string } | null> {
  return uploadBase64ImageToStorage(base64DataUrl, userId, itemId, "clips");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 엔드포인트
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/v1/save-url ────────────────────────────────────────────────────
app.post("/api/v1/save-url", async (req: Request, res: Response): Promise<void> => {
  const {
    url, title, timestamp, img_url,
    screenshot_base64, screenshot_bg_color, category,
    img_thumbnail_b64,
    origin_source,
    clip_image_base64, clip_size,
    is_bgremoved, is_erased, is_upscaled,
  } = req.body;

  const isValidString = (v: unknown) => typeof v === "string" && (v as string).trim().length > 0;
  const isValidStringOrEmpty = (v: unknown) => typeof v === "string";
  const isValidTimestamp = (v: unknown) => typeof v === "number" && Number.isFinite(v);

  const urlValidation = img_url ? isValidStringOrEmpty(url) : isValidString(url);
  if (!urlValidation || !isValidString(title) || !isValidTimestamp(timestamp)) {
    res.status(400).json({error: "Invalid payload"});
    return;
  }

  const resolvedUrl = url ? String(url).trim() : "";
  const resolvedImgUrl = img_url ? String(img_url).trim() : "";
  // === PHASE_ORIGIN_SOURCE_DEDUP ===
  // origin_source replaces img_url as the dedup key. Distinct because
  // video clips put base64 data URLs in img_url (changes between captures
  // of the same video) — origin_source uses video.src (stable URL).
  // For image clips, origin_source equals img_url (already a stable URL).
  const resolvedOriginSource = typeof origin_source === "string"
    ? origin_source.trim() : "";
  // === END PHASE_ORIGIN_SOURCE_DEDUP ===
  const clientCategoryRaw = typeof category === "string" ? category.trim() : "";
  const clientPlatformRaw = typeof req.body.platform === "string" ? req.body.platform.trim() : "";
  const clientSenderRaw = typeof req.body.sender === "string" ? req.body.sender.trim() : "";
  const clientScreenshotPaddingRaw = typeof req.body.screenshot_padding === "number" ?
    req.body.screenshot_padding : 0;
  const clientTempIdRaw = typeof req.body.temp_id === "string" ?
    req.body.temp_id.trim() : "";

  // === PHASE_CLIP_IMAGE_STORAGE ===
  const resolvedClipImageB64 =
    typeof clip_image_base64 === "string" &&
    clip_image_base64.trim().startsWith("data:image/") ?
      clip_image_base64.trim() : "";
  const resolvedClipSize = typeof clip_size === "string" ?
    clip_size.trim() : "";
  // === END PHASE_CLIP_IMAGE_STORAGE ===

  const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : "";
  if (!userId) {
    res.status(400).json({error: "userId is required"});
    return;
  }

  // === PHASE_ORIGIN_SOURCE_DEDUP ===
  // Dedup by url + origin_source. Replaces the former img_url-based rule
  // (Phase 18a). Required because video clips use base64 data URLs as
  // img_url which change between captures — origin_source provides a
  // stable identifier (<video>.src for video, image URL for image).
  // Client mirrors this in sidepanel.js PHASE_ORIGIN_SOURCE_DEDUP.
  //
  // Rule:
  //   existing.url === incoming.url
  //   AND incoming.origin_source and existing.origin_source are non-empty
  //   AND existing.origin_source === incoming.origin_source
  //
  // When incoming origin_source is empty → dedup skipped, new doc created.
  // Legacy docs without origin_source field cannot match → also create
  // new docs (acceptable trade-off, no migration).

  try {
    const db = getFirestore();
    const itemsRef = db.collection(`users/${userId}/items`);

    let dedupHitDocId: string | null = null;

    if (resolvedOriginSource) {
      try {
        const allSnap = await itemsRef.get();
        for (const doc of allSnap.docs) {
          const data = doc.data();
          const existingUrl = typeof data.url === "string" ? data.url.trim() : "";
          if (existingUrl !== resolvedUrl) continue;
          const existingOriginSource = typeof data.origin_source === "string"
            ? data.origin_source.trim() : "";
          if (!existingOriginSource) continue;
          if (existingOriginSource !== resolvedOriginSource) continue;
          dedupHitDocId = doc.id;
          break;
        }
      } catch (searchErr) {
        console.error("[save-url] dedup search failed:", searchErr);
        dedupHitDocId = null;
      }
    }
    // When resolvedOriginSource is empty, dedupHitDocId stays null and the
    // create-new branch below runs.
  // === END PHASE_ORIGIN_SOURCE_DEDUP ===

    const domain = resolvedUrl.length > 0 ?
      extractSource(resolvedUrl) : (resolvedImgUrl ? "local" : "unknown");

    // Recompute newOrder for both paths — the doc (new or existing)
    // floats to the top of the user's list either way.
    let newOrder = 0;
    try {
      const minSnap = await itemsRef.orderBy("order", "asc").limit(1).get();
      if (!minSnap.empty) {
        const minOrderVal = minSnap.docs[0].data().order;
        newOrder = typeof minOrderVal === "number" ? minOrderVal - 1 : 0;
      }
    } catch {
      newOrder = 0;
    }

    // Build the field set used for both create and update.
    // For dedup-update, createdAt and directoryId are intentionally
    // excluded (preserved on the existing doc).
    const baseFields: Record<string, any> = {
      url: resolvedUrl,
      title: String(title).trim(),
      timestamp,
      domain,
      order: newOrder,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (resolvedImgUrl) baseFields.img_url = resolvedImgUrl;
    if (resolvedOriginSource) baseFields.origin_source = resolvedOriginSource;
    // === PHASE_IMAGE_URL_PIPELINE ===
    const resolvedImgThumbnailB64 =
      typeof img_thumbnail_b64 === "string" &&
      img_thumbnail_b64.trim().startsWith("data:image/") ?
        img_thumbnail_b64.trim() :
        "";
    if (resolvedImgThumbnailB64) baseFields.img_thumbnail_b64 = resolvedImgThumbnailB64;
    // === END PHASE_IMAGE_URL_PIPELINE ===
    if (clientCategoryRaw) baseFields.category = clientCategoryRaw;
    if (clientPlatformRaw) baseFields.platform = clientPlatformRaw;
    if (clientSenderRaw) baseFields.sender = clientSenderRaw;
    if (clientScreenshotPaddingRaw > 0) baseFields.screenshot_padding = clientScreenshotPaddingRaw;
    if (clientTempIdRaw) baseFields.temp_id = clientTempIdRaw;
    if (typeof is_bgremoved === "boolean") baseFields.is_bgremoved = is_bgremoved;
    if (typeof is_erased === "boolean") baseFields.is_erased = is_erased;
    if (typeof is_upscaled === "boolean") baseFields.is_upscaled = is_upscaled;

    // Determine the target doc up front so the clip-image Storage upload can
    // use its id for the object path, and the resulting storage URL is written
    // in the SAME create/update (no async patch window).
    const docRef = dedupHitDocId ? itemsRef.doc(dedupHitDocId) : itemsRef.doc();
    const docId = docRef.id;
    const isUpdate = !!dedupHitDocId;

    // === PHASE_CLIP_IMAGE_STORAGE ===
    // When the client sends the size-adjusted clip image (clip_size != origin),
    // upload it synchronously and override img_url with the stable storage URL,
    // so re-clip / upload reproduce the exact clipped image. On upload failure,
    // baseFields keeps the resolvedImgUrl fallback (the remote URL). dedup is
    // unaffected: origin_source remains the resolved remote URL from the client.
    if (resolvedClipImageB64) {
      const clipUpload =
        await uploadClipImageToStorage(resolvedClipImageB64, userId, docId);
      if (clipUpload) baseFields.img_url = clipUpload.publicUrl;
    }
    if (resolvedClipSize) baseFields.clip_size = resolvedClipSize;
    // === END PHASE_CLIP_IMAGE_STORAGE ===

    if (isUpdate) {
      // Dedup hit: update existing doc. createdAt and directoryId are NOT in
      // baseFields, so they stay as-is.
      await docRef.update(baseFields);
    } else {
      // No dedup match: create new doc with createdAt + default directoryId.
      await docRef.set({
        ...baseFields,
        directoryId: "undefined",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Screenshot Storage upload (background) — applies to both
    // create and update paths. Writes to the resolved docId.
    if (
      screenshot_base64 && userId && !resolvedImgUrl
    ) {
      const docPath = `users/${userId}/items/${docId}`;
      (async () => {
        try {
          const uploadResult = await uploadScreenshotToStorage(screenshot_base64, userId, docId);
          if (uploadResult) {
            const screenshotBgColor = typeof screenshot_bg_color === "string" ?
              screenshot_bg_color.trim() : "";
            await getFirestore().doc(docPath).update({
              img_url: uploadResult.publicUrl,
              ...(screenshotBgColor ? {screenshot_bg_color: screenshotBgColor} : {}),
            });
          }
        } catch {/* ignore */}
      })();
    }

    // Build response. For backward compatibility, include the same
    // `entry` shape as before, plus the new top-level isUpdate flag.
    res.status(isUpdate ? 200 : 201).json({
      success: true,
      entry: {...baseFields, id: docId},
      savedTo: "firestore",
      isUpdate,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[save-url] Firestore save failed:", msg);
    res.status(500).json({error: "Failed to save"});
  }
});

// ── POST /api/v1/firestore/move-item ─────────────────────────────────────────
app.post("/api/v1/firestore/move-item", async (req: Request, res: Response): Promise<void> => {
  try {
    const {userId, itemId, targetDirectoryId, newIndex, sourceDirectoryId} = req.body;
    if (!userId || !itemId || newIndex == null) {
      res.status(400).json({error: "Missing required fields"});
      return;
    }
    const targetDirFilter = targetDirectoryId == null ? "undefined" : String(targetDirectoryId);
    const sourceDirFilter = sourceDirectoryId == null ? "undefined" : String(sourceDirectoryId);
    const db = getFirestore();
    const itemsRef = db.collection(`users/${userId}/items`);
    let targetSnap;
    try {
      targetSnap = await itemsRef
        .where("directoryId", "==", targetDirFilter).orderBy("order", "asc").get();
    } catch {
      targetSnap = await itemsRef
        .where("directoryId", "==", targetDirFilter).orderBy("createdAt", "desc").get();
    }
    const draggedRef = itemsRef.doc(String(itemId));
    const draggedSnap = await draggedRef.get();
    if (!draggedSnap.exists) {
      res.status(404).json({error: "Item not found"}); return;
    }
    const targetItems = targetSnap.docs
      .filter((d) => d.id !== String(itemId))
      .map((d) => ({id: d.id, ref: d.ref}));
    const clampedIndex = Math.max(0, Math.min(Number(newIndex), targetItems.length));
    targetItems.splice(clampedIndex, 0, {id: String(itemId), ref: draggedRef});
    const batch = db.batch();
    if (targetDirFilter !== sourceDirFilter) batch.update(draggedRef, {directoryId: targetDirFilter});
    targetItems.forEach(({ref}, index) => {
      batch.update(ref, {order: index});
    });
    await batch.commit();
    res.status(200).json({success: true});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({error: msg});
  }
});

// ── POST /api/v1/firestore/move-directory ────────────────────────────────────
app.post("/api/v1/firestore/move-directory", async (req: Request, res: Response): Promise<void> => {
  try {
    const {userId, directoryId, newIndex} = req.body;
    if (!userId || !directoryId || newIndex == null) {
      res.status(400).json({error: "Missing required fields"});
      return;
    }
    const db = getFirestore();
    const dirsRef = db.collection(`users/${userId}/directories`);
    let dirsSnap;
    try {
      dirsSnap = await dirsRef.orderBy("order", "asc").get();
    } catch {
      dirsSnap = await dirsRef.orderBy("createdAt", "asc").get();
    }
    const dirs = dirsSnap.docs
      .filter((d) => d.id !== String(directoryId))
      .map((d) => ({id: d.id, ref: d.ref}));
    const draggedRef = dirsRef.doc(String(directoryId));
    const draggedSnap = await draggedRef.get();
    if (!draggedSnap.exists) {
      res.status(404).json({error: "Directory not found"}); return;
    }
    const clampedIndex = Math.max(0, Math.min(Number(newIndex), dirs.length));
    dirs.splice(clampedIndex, 0, {id: String(directoryId), ref: draggedRef});
    const batch = db.batch();
    dirs.forEach(({ref}, index) => {
      batch.update(ref, {order: index});
    });
    await batch.commit();
    res.status(200).json({success: true});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({error: msg});
  }
});

// ── DELETE /api/v1/items/:itemId ─────────────────────────────────────────────
app.delete("/api/v1/items/:itemId", async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = String(req.params.itemId ?? "");
    const rawUserId = req.query.userId ?? req.body?.userId;
    const userId = Array.isArray(rawUserId) ?
      String(rawUserId[0] ?? "") :
      typeof rawUserId === "string" ? rawUserId : String(rawUserId ?? "");

    if (!itemId || !itemId.trim()) {
      res.status(400).json({error: "Missing itemId"}); return;
    }
    if (!userId || !userId.trim()) {
      res.status(400).json({error: "Missing userId"}); return;
    }

    const uid = userId.trim();
    const docId = itemId.trim();
    const db = getFirestore();
    const docPath = `users/${uid}/items/${docId}`;

    let imgUrl = "";
    try {
      const snap = await db.doc(docPath).get();
      if (snap.exists) imgUrl = String(snap.data()?.img_url || "").trim();
    } catch {/* proceed */}

    await db.doc(docPath).delete();

    // Reclaim this item's Storage objects.
    try {
      const bucket = getStorage();
      const bucketPrefix = `https://storage.googleapis.com/${bucket.name}/`;
      // Screenshot object: the extension picks png/jpg, so derive the exact
      // path from img_url (only when img_url currently points at a screenshot).
      if (imgUrl.includes("/screenshots/") && imgUrl.startsWith(bucketPrefix)) {
        await bucket.file(imgUrl.slice(bucketPrefix.length))
          .delete().catch(() => { /* missing/already gone — ignore */ });
      }
      // Clip image: always at the deterministic clips/{uid}/{docId}.png. Delete
      // it unconditionally so an object orphaned by a later img_url change
      // (e.g. re-clipping the same item at 'origin', which reverts img_url to
      // the remote URL) is still reclaimed. Missing object → ignored. Object
      // deletes are free, so the no-op call for origin-only items is harmless.
      await bucket.file(`clips/${uid}/${docId}.png`)
        .delete().catch(() => { /* missing/already gone — ignore */ });
    } catch {/* ignore */}

    res.status(200).json({success: true});
  } catch {
    res.status(500).json({error: "Delete failed"});
  }
});

// ── GET /api/v1/image-proxy ───────────────────────────────────────────────────
app.get("/api/v1/image-proxy", async (req: Request, res: Response): Promise<void> => {
  const rawUrl = req.query.url;
  const imageUrl = Array.isArray(rawUrl) ?
    String(rawUrl[0] ?? "") :
    typeof rawUrl === "string" ? rawUrl : "";

  if (!imageUrl) {
    res.status(400).json({error: "Missing url parameter"}); return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    res.status(400).json({error: "Invalid URL"}); return;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    res.status(400).json({error: "Only http/https URLs are allowed"});
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(imageUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": `${parsedUrl.protocol}//${parsedUrl.hostname}/`,
      },
    } as any);
    clearTimeout(timeoutId);

    if (!response.ok) {
      res.status(response.status).json({error: `Upstream error: ${response.status}`});
      return;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (err: any) {
    if (err.name === "AbortError") {
      res.status(504).json({error: "Image fetch timeout"}); return;
    }
    res.status(502).json({error: "Failed to fetch image"});
  }
});

// === PHASE_BG_REMOVE_FAL ===
const BG_REMOVE_MAX_BASE64_BYTES = 10 * 1024 * 1024; // 10 MiB base64 payload
const FAL_BG_REMOVE_URL = "https://fal.run/fal-ai/birefnet/v2";
const FAL_BG_REMOVE_TIMEOUT_MS = 30_000;

async function falImageToDataUrl(
  image: {url?: string; content_type?: string | null}
): Promise<string | null> {
  const url = typeof image?.url === "string" ? image.url.trim() : "";
  if (!url) return null;
  if (url.startsWith("data:image/")) return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FAL_BG_REMOVE_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {method: "GET", signal: controller.signal} as any);
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = resp.headers.get("content-type") ||
      (typeof image.content_type === "string" ? image.content_type : "image/png");
    const mime = ct.split(";")[0].trim() || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

const BG_REMOVE_DAILY_LIMIT = 200;

async function checkAndIncrementBgQuota(uid: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const ref = getFirestore().collection("usage").doc(`bg_remove_${uid}_${day}`);
  try {
    return await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = snap.exists ? (snap.data()?.count || 0) : 0;
      if (count >= BG_REMOVE_DAILY_LIMIT) return false;
      tx.set(ref, {
        count: count + 1,
        uid,
        day,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      return true;
    });
  } catch (e) {
    console.error(`[bg-remove] uid=${uid} quota check failed`, e);
    return true;
  }
}

// ── POST /api/v1/bg-remove ────────────────────────────────────────────────────
app.post("/api/v1/bg-remove", async (req: Request, res: Response): Promise<void> => {
  const uid = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  if (!uid) {
    res.status(401).json({error: "Sign in required"});
    return;
  }

  const rawDataUrl = req.body?.dataUrl;
  if (typeof rawDataUrl !== "string" || !rawDataUrl.trim().startsWith("data:image/")) {
    res.status(400).json({error: "Invalid payload"});
    return;
  }
  const dataUrl = rawDataUrl.trim();

  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) {
    res.status(400).json({error: "Invalid payload"});
    return;
  }
  const base64Payload = dataUrl.slice(commaIdx + 1);
  if (base64Payload.length > BG_REMOVE_MAX_BASE64_BYTES) {
    res.status(413).json({error: "Image too large"});
    return;
  }

  const allowed = await checkAndIncrementBgQuota(uid);
  if (!allowed) {
    console.warn(`[bg-remove] uid=${uid} quota exceeded`);
    res.status(429).json({error: "Daily limit reached"});
    return;
  }

  const falKey = falApiKey.value();
  if (!falKey) {
    console.error(`[bg-remove] uid=${uid} fal key not configured`);
    res.status(503).json({error: "Background removal not configured"});
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FAL_BG_REMOVE_TIMEOUT_MS);
    let falResp: Awaited<ReturnType<typeof fetch>>;
    try {
      falResp = await fetch(FAL_BG_REMOVE_URL, {
        method: "POST",
        // fal keeps request inputs and outputs for thirty days by default to populate its
        // dashboard history. The clip travels inside that payload, so this header turns the
        // retention off. The trade is that failed calls cannot be inspected in fal's console;
        // the uid and outcome are logged here instead.
        headers: {
          "Authorization": `Key ${falKey}`,
          "Content-Type": "application/json",
          "X-Fal-Store-IO": "0",
        },
        body: JSON.stringify({
          image_url: dataUrl,
          sync_mode: true,
        }),
        signal: controller.signal,
      } as any);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!falResp.ok) {
      console.error(`[bg-remove] uid=${uid} fal status=${falResp.status}`);
      res.status(502).json({error: "Background removal failed"});
      return;
    }

    const falData = await falResp.json() as {image?: {url?: string; content_type?: string | null}};
    const resultDataUrl = await falImageToDataUrl(falData?.image ?? {});
    if (!resultDataUrl) {
      console.error(`[bg-remove] uid=${uid} fal response unusable`);
      res.status(502).json({error: "Background removal failed"});
      return;
    }

    console.log(`[bg-remove] uid=${uid} ok`);
    res.status(200).json({ok: true, dataUrl: resultDataUrl});
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.error(`[bg-remove] uid=${uid} fal timeout`);
      res.status(504).json({error: "Background removal timed out"});
      return;
    }
    console.error(`[bg-remove] uid=${uid} failed`, err);
    res.status(502).json({error: "Background removal failed"});
  }
});
// === END PHASE_BG_REMOVE_FAL ===

// ═══════════════════════════════════════════════════════════════════════════════
// Cloud Functions 진입점
// ═══════════════════════════════════════════════════════════════════════════════
// === PHASE_ANON_CLIP_TELEMETRY ===
// POST /api/v1/telemetry/anonymous-clip
// Aggregate-only counter for clips performed while logged out. The request
// body is intentionally ignored: no URL, site, page, or user identifier is
// ever read or stored. This keeps the data outside CWS "web browsing
// activity" scope. Unauthenticated by design (mirrors image-proxy).
app.post(
  "/api/v1/telemetry/anonymous-clip",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const db = getFirestore();
      const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      await db
        .collection("stats")
        .doc("anonymous_clips")
        .set(
          {
            total: admin.firestore.FieldValue.increment(1),
            [`days.${day}`]: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true}
        );
      res.status(204).send("");
    } catch (err) {
      // Telemetry must never affect the user; swallow and 204.
      console.error("anonymous-clip telemetry failed", err);
      res.status(204).send("");
    }
  }
);
// === END PHASE_ANON_CLIP_TELEMETRY ===

export const api = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 60,
    region: "asia-northeast3",
    secrets: [falApiKey],
  },
  app
);
