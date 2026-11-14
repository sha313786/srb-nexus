import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { GuildMember, AttachmentBuilder } from 'discord.js';

let cachedNaadanBuffer: Buffer | null = null;
const NAADAN_REMOTE_TEMPLATE_URL = 'https://raw.githubusercontent.com/sha313786/srb-nexus/main/assets/templates/naadan_welcome.jpg';

// Register cross-platform fonts if not already registered
try {
  const fontDirCandidates = [
    path.join(__dirname, '../../assets/fonts'),
    path.join(__dirname, '../assets/fonts'),
    path.join(process.cwd(), 'assets/fonts'),
    path.join(process.cwd(), 'dist/assets/fonts'),
  ];
  const fontDir = fontDirCandidates.find((d) => fs.existsSync(d));

  if (fontDir) {
    const outfitPath = path.join(fontDir, 'Outfit.ttf');
    const jbPath = path.join(fontDir, 'JetBrainsMono.ttf');
    if (fs.existsSync(outfitPath) && !GlobalFonts.has('Outfit')) {
      GlobalFonts.registerFromPath(outfitPath, 'Outfit');
    }
    if (fs.existsSync(jbPath) && !GlobalFonts.has('JetBrainsMono')) {
      GlobalFonts.registerFromPath(jbPath, 'JetBrainsMono');
    }
  }
} catch (fontErr) {
  console.error('[CANVAS] Failed to register custom fonts in welcomeCard', fontErr);
}

/**
 * Dynamically generates a high-definition Welcome Card using Canvas
 */
export async function createWelcomeCard(
  member: GuildMember,
  customBgUrl?: string | null
): Promise<AttachmentBuilder> {
  const isNaadan =
    member.guild.id === '1558245529417293884' ||
    customBgUrl === 'naadan' ||
    (customBgUrl && customBgUrl.toLowerCase().includes('naadan'));

  // ----------------------------------------------------
  // 1. NAADAN LEGACY ESPORTS CUSTOM BANNER TEMPLATE
  // ----------------------------------------------------
  if (isNaadan) {
    const templateCandidates = [
      path.join(__dirname, '../../assets/templates/naadan_welcome.jpg'),
      path.join(__dirname, '../assets/templates/naadan_welcome.jpg'),
      path.join(process.cwd(), 'assets/templates/naadan_welcome.jpg'),
      path.join(process.cwd(), 'dist/assets/templates/naadan_welcome.jpg'),
    ];
    const naadanTemplatePath = templateCandidates.find((p) => fs.existsSync(p));

    const canvas = createCanvas(1024, 425);
    const ctx = canvas.getContext('2d');

    let bgLoaded = false;
    if (customBgUrl && customBgUrl.startsWith('http')) {
      try {
        const bgImg = await loadImage(customBgUrl);
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        bgLoaded = true;
      } catch {
        // fallback to local or remote template
      }
    }

    if (!bgLoaded && naadanTemplatePath) {
      try {
        const bgImg = await loadImage(naadanTemplatePath);
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        bgLoaded = true;
      } catch (err) {
        console.error('[BOT] Failed to load local naadan template', err);
      }
    }

    if (!bgLoaded) {
      try {
        if (!cachedNaadanBuffer) {
          const res = await axios.get(NAADAN_REMOTE_TEMPLATE_URL, {
            responseType: 'arraybuffer',
            timeout: 7000,
          });
          cachedNaadanBuffer = Buffer.from(res.data as any);
        }
        const bgImg = await loadImage(cachedNaadanBuffer);
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        bgLoaded = true;
      } catch (err) {
        console.error('[BOT] Failed to load remote naadan template from GitHub raw', err);
      }
    }

    if (bgLoaded) {
        // Precision slot coordinates:
        // Fiery Flame Ring Outer Avatar
        const cx = 163;
        const cy = 193;
        const r = 80;

        try {
          const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
          const avatar = await loadImage(avatarUrl);

          // Clipped circular avatar
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
          ctx.restore();

          // Subtle fiery blend ring along avatar border
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 68, 0, 0.45)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        } catch (err) {
          console.error('[BOT] Failed to draw avatar on Naadan welcome card', err);
        }

        // Username inside the glowing hexagonal name plate
        const username = member.user.username;
        const boxCx = 162;
        const boxCy = 296;
        const maxW = 180;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let fontSize = 16;
        ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
        while (ctx.measureText(username).width > maxW && fontSize > 10) {
          fontSize -= 1;
          ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
        }

        // Fiery red outer glow
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(username, boxCx, boxCy);

        // Crisp white text overlay
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff7ed';
        ctx.fillText(username, boxCx, boxCy);
        ctx.restore();

        const buffer = await canvas.encode('png');
        return new AttachmentBuilder(buffer, { name: 'welcome-card.png' });
      }
    }

  // ----------------------------------------------------
  // 2. DEFAULT NEXUS CYBER CANVAS GENERATOR (Fallback)
  // ----------------------------------------------------
  const canvas = createCanvas(1024, 450);
  const ctx = canvas.getContext('2d');

  let bgLoaded = false;

  // Base Wallpaper
  if (customBgUrl && customBgUrl.startsWith('http')) {
    try {
      const bgImage = await loadImage(customBgUrl);
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(5, 7, 12, 0.60)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      bgLoaded = true;
    } catch (err) {
      console.error('[BOT] Failed to load custom background image, using procedural theme', err);
    }
  }

  if (!bgLoaded) {
    const t = (customBgUrl || 'cyber').toLowerCase();
    if (t === 'space') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#03050e');
      grad.addColorStop(0.5, '#0c0822');
      grad.addColorStop(1, '#05020d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const n1 = ctx.createRadialGradient(250, 150, 20, 250, 150, 320);
      n1.addColorStop(0, 'rgba(139, 92, 246, 0.32)');
      n1.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = n1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const n2 = ctx.createRadialGradient(820, 280, 20, 820, 280, 360);
      n2.addColorStop(0, 'rgba(59, 130, 246, 0.28)');
      n2.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = n2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#ffffff';
      const stars = [
        [80, 50, 1.5, 0.8], [140, 120, 1.2, 0.6], [220, 40, 2, 0.9], [310, 95, 1, 0.5],
        [420, 60, 1.8, 0.7], [530, 130, 1.2, 0.6], [640, 45, 2.2, 0.9], [750, 110, 1, 0.4],
        [880, 55, 1.7, 0.8], [950, 90, 1.2, 0.5], [60, 320, 1.5, 0.7], [180, 380, 1, 0.4],
        [270, 350, 2, 0.8], [390, 400, 1.4, 0.6], [510, 360, 1, 0.5], [680, 390, 1.8, 0.7],
        [790, 340, 1.2, 0.6], [890, 410, 2.1, 0.9], [970, 330, 1, 0.5]
      ];
      for (const [x, y, r, a] of stars) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (t === 'aurora') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#020912');
      grad.addColorStop(0.6, '#041822');
      grad.addColorStop(1, '#020d14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const a1 = ctx.createLinearGradient(0, 30, canvas.width, 240);
      a1.addColorStop(0, 'rgba(16, 185, 129, 0)');
      a1.addColorStop(0.35, 'rgba(16, 185, 129, 0.35)');
      a1.addColorStop(0.7, 'rgba(6, 182, 212, 0.28)');
      a1.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = a1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (t === 'obsidian' || t === 'gold') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#060608');
      grad.addColorStop(0.5, '#141007');
      grad.addColorStop(1, '#080603');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const g1 = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 40, canvas.width / 2, canvas.height / 2, 460);
      g1.addColorStop(0, 'rgba(245, 158, 11, 0.20)');
      g1.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (t === 'synthwave') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#1d072a');
      grad.addColorStop(0.55, '#3b0730');
      grad.addColorStop(1, '#0a0210');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const sunGrad = ctx.createRadialGradient(canvas.width / 2, 210, 10, canvas.width / 2, 210, 115);
      sunGrad.addColorStop(0, '#ff007f');
      sunGrad.addColorStop(0.6, '#f43f5e');
      sunGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 210, 115, 0, Math.PI * 2);
      ctx.fill();
    } else if (t === 'matrix') {
      ctx.fillStyle = '#020904';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
    } else if (t === 'minimal') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#090b10');
      grad.addColorStop(0.5, '#10141d');
      grad.addColorStop(1, '#080a0e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // Cyber Neon (Default)
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#050711');
      grad.addColorStop(0.5, '#091026');
      grad.addColorStop(1, '#0f081c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      const hLine = ctx.createLinearGradient(0, canvas.height / 2, canvas.width, canvas.height / 2);
      hLine.addColorStop(0, 'rgba(0, 240, 255, 0)');
      hLine.addColorStop(0.5, 'rgba(0, 240, 255, 0.18)');
      hLine.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = hLine;
      ctx.fillRect(0, canvas.height / 2 - 2, canvas.width, 4);
    }
  }

  // Central Frosted Glass Panel
  const panelX = 35, panelY = 35, panelW = 954, panelH = 380, panelR = 24;
  ctx.save();
  ctx.fillStyle = 'rgba(9, 14, 26, 0.80)';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, panelR);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Cyber Corner Accent Brackets
  const cornerLen = 28;
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(panelX + cornerLen, panelY);
  ctx.lineTo(panelX + 4, panelY);
  ctx.lineTo(panelX + 4, panelY + cornerLen);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(panelX + panelW - cornerLen, panelY);
  ctx.lineTo(panelX + panelW - 4, panelY);
  ctx.lineTo(panelX + panelW - 4, panelY + cornerLen);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(panelX + cornerLen, panelY + panelH);
  ctx.lineTo(panelX + 4, panelY + panelH);
  ctx.lineTo(panelX + 4, panelY + panelH - cornerLen);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(panelX + panelW - cornerLen, panelY + panelH);
  ctx.lineTo(panelX + panelW - 4, panelY + panelH);
  ctx.lineTo(panelX + panelW - 4, panelY + panelH - cornerLen);
  ctx.stroke();

  // Top-Right Protocol Tag
  ctx.save();
  ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
  ctx.beginPath();
  ctx.roundRect(750, 56, 210, 32, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Glowing status dot
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(766, 72, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px JetBrainsMono, Outfit, sans-serif';
  ctx.fillText('SRB NEXUS GATEWAY', 780, 76);
  ctx.restore();

  // User Avatar Area
  const avatarCenterX = 195;
  const avatarCenterY = 225;
  const avatarRadius = 88;

  try {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar = await loadImage(avatarUrl);

    // Glowing Cyan Outer Halo
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Clipped circular avatar
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.restore();

    // Online Status Badge on Avatar
    ctx.beginPath();
    ctx.arc(avatarCenterX + 60, avatarCenterY + 60, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 4;
    ctx.stroke();
  } catch (err) {
    console.error('[BOT] Failed to draw avatar on canvas', err);
  }

  // Typography & Text Hierarchy
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px JetBrainsMono, monospace, sans-serif';
  ctx.fillText('// NEW OPERATIVE JOINED', 335, 145);

  const serverName = member.guild.name.toUpperCase();
  const truncatedServer = serverName.length > 24 ? serverName.slice(0, 22) + '...' : serverName;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Outfit, sans-serif';
  ctx.fillText(`WELCOME TO ${truncatedServer}`, 335, 192);

  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 38px Outfit, sans-serif';
  ctx.fillText(member.user.username, 335, 242);

  // Member Count Badge Pill
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.beginPath();
  ctx.roundRect(335, 276, 270, 48, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(358, 300, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 18px Outfit, sans-serif';
  ctx.fillText(`Member #${member.guild.memberCount}`, 375, 307);
  ctx.restore();

  // Bottom Telemetry
  ctx.fillStyle = '#64748b';
  ctx.font = '11px JetBrainsMono, monospace, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`STATUS: VERIFIED  |  GUILD ID: ${member.guild.id}`, 955, 395);
  ctx.textAlign = 'left';

  const buffer = await canvas.encode('png');
  return new AttachmentBuilder(buffer, { name: 'welcome-card.png' });
}
