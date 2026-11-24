import type { TacticalProject, TacticalScene } from './types';

function slugifyFile(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tactical-board'
  );
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Clones the live SVG and removes interactive-only editor overlays (selection handles, marquee)
 * so exports are broadcast-clean.
 */
function buildCleanSvgString(svgEl: SVGSVGElement): {
  svgString: string;
  width: number;
  height: number;
} {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-editor-only="true"]').forEach((n) => n.remove());

  const vb = svgEl.viewBox.baseVal;
  const width = vb && vb.width > 0 ? vb.width : 1134;
  const height = vb && vb.height > 0 ? vb.height : 764;

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(Math.round(width)));
  clone.setAttribute('height', String(Math.round(height)));

  // Inline basic font family so standalone SVG renders crisply outside browser
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `
    text { font-family: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  `;
  clone.insertBefore(styleEl, clone.firstChild);

  const serializer = new XMLSerializer();
  return {
    svgString: serializer.serializeToString(clone),
    width,
    height,
  };
}

function svgStringToImage(svgString: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

export function exportPitchSvg(
  svgEl: SVGSVGElement,
  projectName: string,
  sceneName: string,
): void {
  const { svgString } = buildCleanSvgString(svgEl);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(
    blob,
    `${slugifyFile(projectName)}-${slugifyFile(sceneName)}.svg`,
  );
}

export async function exportPitchPng(
  svgEl: SVGSVGElement,
  projectName: string,
  sceneName: string,
  scale = 2,
): Promise<void> {
  const { svgString, width, height } = buildCleanSvgString(svgEl);
  const img = await svgStringToImage(svgString);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.fillStyle = '#090d12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('PNG encoding failed');
  triggerDownload(
    blob,
    `${slugifyFile(projectName)}-${slugifyFile(sceneName)}.png`,
  );
}

/**
 * Exports a 1920x1080 widescreen presentation graphic with title bar,
 * team badges/matchup, scene caption, and tactical notes footer.
 */
export async function exportPresentationPng(
  svgEl: SVGSVGElement,
  project: TacticalProject,
  scene: TacticalScene,
  sceneIndex: number,
): Promise<void> {
  const { svgString, width, height } = buildCleanSvgString(svgEl);
  const img = await svgStringToImage(svgString);

  const W = 1920;
  const H = 1080;
  const headerH = 96;
  const footerH = scene.notes.trim() ? 104 : 68;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0f16');
  grad.addColorStop(1, '#06090e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Header bar
  ctx.fillStyle = '#101720';
  ctx.fillRect(0, 0, W, headerH);
  ctx.strokeStyle = '#1f2a38';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, headerH);
  ctx.lineTo(W, headerH);
  ctx.stroke();

  // Accent bar
  ctx.fillStyle = project.home.primaryColor || '#22c55e';
  ctx.fillRect(0, 0, 8, headerH);

  // Project Title & Matchup
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 32px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(project.name, 42, 46);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 18px "IBM Plex Sans", system-ui, sans-serif';
  const matchup = [
    project.home.visible
      ? `${project.home.clubName} (${project.home.formation})`
      : null,
    project.away.visible
      ? `${project.away.clubName} (${project.away.formation})`
      : null,
  ]
    .filter(Boolean)
    .join('  vs  ');
  ctx.fillText(matchup, 42, 76);

  // Scene pill on top right
  const sceneLabel = `SCENE ${sceneIndex + 1}/${project.scenes.length} · ${scene.name}`;
  ctx.font = '600 18px "IBM Plex Sans", system-ui, sans-serif';
  const labelW = ctx.measureText(sceneLabel).width + 36;
  ctx.fillStyle = '#17212f';
  ctx.strokeStyle = '#2d3c50';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(W - labelW - 40, 26, labelW, 44, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(sceneLabel, W - labelW - 22, 54);

  // Fit pitch cleanly into center canvas region
  const availW = W - 80;
  const availH = H - headerH - footerH - 36;
  const ratio = Math.min(availW / width, availH / height);
  const drawW = width * ratio;
  const drawH = height * ratio;
  const drawX = (W - drawW) / 2;
  const drawY = headerH + (H - headerH - footerH - drawH) / 2;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  // Footer
  ctx.fillStyle = '#0d131c';
  ctx.fillRect(0, H - footerH, W, footerH);
  ctx.strokeStyle = '#1f2a38';
  ctx.beginPath();
  ctx.moveTo(0, H - footerH);
  ctx.lineTo(W, H - footerH);
  ctx.stroke();

  if (scene.notes.trim()) {
    ctx.fillStyle = '#64748b';
    ctx.font = '600 14px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillText('TACTICAL NOTES', 42, H - footerH + 30);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '400 21px "IBM Plex Sans", system-ui, sans-serif';
    ctx.fillText(scene.notes.slice(0, 140), 42, H - footerH + 64);
  }

  ctx.fillStyle = '#475569';
  ctx.font = '500 15px "IBM Plex Sans", system-ui, sans-serif';
  const wm = 'EPL TACTICAL STUDIO';
  const wmW = ctx.measureText(wm).width;
  ctx.fillText(wm, W - wmW - 40, H - 24);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('Presentation PNG encoding failed');
  triggerDownload(
    blob,
    `${slugifyFile(project.name)}-slide-${sceneIndex + 1}.png`,
  );
}

export function exportProjectJson(project: TacticalProject): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerDownload(blob, `${slugifyFile(project.name)}.tactics.json`);
}

/**
 * Exports multi-scene animation to WebM video via offscreen Canvas + MediaRecorder.
 * Steps the live playhead cleanly so the exact rendered SVG frames are captured.
 */
export async function exportAnimationWebm(opts: {
  getSvg: () => SVGSVGElement | null;
  sceneCount: number;
  speed: number;
  projectName: string;
  setPlayhead: (val: number) => void;
  onProgress: (pct: number) => void;
}): Promise<void> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Video recording (MediaRecorder) is not supported in this browser.');
  }
  const svg0 = opts.getSvg();
  if (!svg0) throw new Error('Pitch SVG unavailable');
  if (opts.sceneCount < 2) {
    throw new Error('Add at least 2 scenes to export an animation video.');
  }

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const { width, height } = buildCleanSvgString(svg0);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * 1.25);
  canvas.height = Math.round(height * 1.25);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  const stream = canvas.captureStream(24);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const donePromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();

  const fps = 20;
  const secondsPerTransition = 1.4 / Math.max(0.25, opts.speed);
  const totalFrames = Math.max(
    20,
    Math.round((opts.sceneCount - 1) * secondsPerTransition * fps),
  );

  try {
    for (let f = 0; f <= totalFrames; f++) {
      const progress = f / totalFrames;
      const playhead = progress * (opts.sceneCount - 1);
      opts.setPlayhead(playhead);
      opts.onProgress(Math.round(progress * 100));

      // Wait two animation frames for React SVG to paint
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );

      const svg = opts.getSvg();
      if (!svg) break;
      const { svgString } = buildCleanSvgString(svg);
      const img = await svgStringToImage(svgString);
      ctx.fillStyle = '#090d12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      await new Promise((r) => setTimeout(r, Math.round(1000 / fps)));
    }
  } finally {
    recorder.stop();
  }

  const blob = await donePromise;
  triggerDownload(blob, `${slugifyFile(opts.projectName)}-animation.webm`);
}
