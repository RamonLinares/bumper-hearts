import * as THREE from 'three';
import type { CampaignStage } from '../game/Campaign';

/** Creates a lightweight, repeatable arena texture whose markings change with the story stage. */
export function createStageFloorTexture(stage: CampaignStage, size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create stage floor texture context.');
  ctx.fillStyle = '#51585b'; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = stage.theme.accent; ctx.fillStyle = stage.theme.secondary;
  ctx.globalAlpha = 0.24; ctx.lineWidth = 4;
  const center = size / 2;
  switch (stage.theme.floorPattern) {
    case 'ticket-grid':
      for (let y=16;y<size;y+=64) for(let x=16;x<size;x+=96){ctx.strokeRect(x,y,68,34);ctx.beginPath();ctx.arc(x,y+17,6,0,Math.PI*2);ctx.arc(x+68,y+17,6,0,Math.PI*2);ctx.stroke();} break;
    case 'circuit':
      for(let y=32;y<size;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(160,y);ctx.lineTo(192,y+28);ctx.lineTo(size,y+28);ctx.stroke();for(let x=48;x<size;x+=128){ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();}} break;
    case 'radio-waves':
      for(let r=42;r<360;r+=46){ctx.beginPath();ctx.arc(center,center,r,0,Math.PI*2);ctx.stroke();} break;
    case 'cafe-checker':
      for(let y=0;y<size;y+=64)for(let x=0;x<size;x+=64)if((x+y)/64%2===0)ctx.fillRect(x,y,64,64); break;
    case 'champion-sunburst':
      for(let i=0;i<24;i+=2){ctx.beginPath();ctx.moveTo(center,center);ctx.arc(center,center,size*.75,i*Math.PI/12,(i+1)*Math.PI/12);ctx.fill();} break;
    case 'midnight-grid':
      for(let i=0;i<=size;i+=48){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,size);ctx.moveTo(0,i);ctx.lineTo(size,i);ctx.stroke();}for(let i=24;i<size;i+=96){ctx.fillRect(i-3,i-3,6,6);} break;
    case 'storm-coils':
      for(let x=32;x<size;x+=96){ctx.beginPath();ctx.moveTo(x,0);for(let y=0;y<size;y+=48)ctx.lineTo(x+(y/48%2?26:-26),y);ctx.stroke();} break;
    case 'case-files':
      for(let y=18;y<size;y+=82)for(let x=20;x<size;x+=116){ctx.save();ctx.translate(x,y);ctx.rotate(((x+y)%3-1)*.08);ctx.strokeRect(0,0,82,52);ctx.fillRect(8,10,48,4);ctx.fillRect(8,22,62,4);ctx.restore();} break;
    case 'sunset-ribbons':
      for(let y=40;y<size;y+=72){ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=size;x+=24)ctx.lineTo(x,y+Math.sin(x/42+y)*18);ctx.stroke();} break;
    case 'marquee-rays':
      for(let i=0;i<32;i++){ctx.beginPath();ctx.moveTo(center,center);ctx.lineTo(center+Math.cos(i*Math.PI/16)*size,center+Math.sin(i*Math.PI/16)*size);ctx.stroke();}for(let r=70;r<360;r+=75){ctx.beginPath();ctx.arc(center,center,r,0,Math.PI*2);ctx.stroke();} break;
  }

  // Preserve the miniature pavilion's aged enamel language beneath every
  // stage motif: recessed modular plates, rivets, tyre arcs and worn flecks.
  const glow = ctx.createRadialGradient(center, center, 18, center, center, size * 0.7);
  glow.addColorStop(0, 'rgba(255, 226, 174, 0.16)');
  glow.addColorStop(0.55, 'rgba(245, 196, 91, 0.035)');
  glow.addColorStop(1, 'rgba(8, 15, 24, 0.24)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.42;
  for (let line = 0; line <= size; line += 64) {
    ctx.strokeStyle = '#111a20';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(line, 0); ctx.lineTo(line, size); ctx.moveTo(0, line); ctx.lineTo(size, line); ctx.stroke();
    ctx.strokeStyle = '#d8bd87';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(line + 2, 0); ctx.lineTo(line + 2, size); ctx.moveTo(0, line + 2); ctx.lineTo(size, line + 2); ctx.stroke();
  }
  for (let y = 64; y < size; y += 64) for (let x = 64; x < size; x += 64) {
    ctx.fillStyle = '#ead29f'; ctx.beginPath(); ctx.arc(x + 5, y + 5, 2, 0, Math.PI * 2); ctx.fill();
  }

  ctx.globalAlpha = 0.18;
  ctx.lineCap = 'round';
  for (let i = 0; i < 15; i += 1) {
    const x = 45 + ((i * 91) % 420); const y = 42 + ((i * 149) % 420);
    ctx.strokeStyle = i % 3 ? '#172125' : stage.theme.secondary;
    ctx.lineWidth = 3 + (i % 3);
    ctx.beginPath(); ctx.ellipse(x, y, 38 + (i % 4) * 15, 12 + (i % 3) * 6, i * 0.43, 0.15, Math.PI * 1.25); ctx.stroke();
  }

  ctx.globalAlpha = 0.13; ctx.fillStyle = '#fff0c2';
  for(let y=16;y<size;y+=32)for(let x=16;x<size;x+=32)ctx.fillRect(x,y,1.5,1.5);
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
