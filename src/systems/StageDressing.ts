import * as THREE from 'three';
import type { CampaignStage } from '../game/Campaign';

export type StageDressingDiagnostics = {
  theme: CampaignStage['theme']['dressing'];
  props: number;
  meshes: number;
  geometries: number;
  materials: number;
};

/** Visual-only arena dressing. Every prop stays beyond the playable rails. */
export class StageDressing {
  readonly group = new THREE.Group();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private animated: { object: THREE.Object3D; speed: number; phase: number; mode: 'turn' | 'pulse' | 'sway' }[] = [];
  private propCount = 0;
  private currentTheme: CampaignStage['theme']['dressing'] = 'ticket-night';

  constructor(stage: CampaignStage) {
    this.group.name = 'StageDressing';
    this.configure(stage);
  }

  configure(stage: CampaignStage): void {
    this.clear();
    this.currentTheme = stage.theme.dressing;
    const accent = this.mat(stage.theme.accent, 0.42, 0.18);
    const secondary = this.mat(stage.theme.secondary, 0.58, 0.08);
    const dark = this.mat('#202938', 0.72, 0.28);
    const light = this.glow(stage.theme.lightColor);

    const add = (prop: THREE.Object3D, x: number, z: number, rotation = 0) => {
      prop.position.set(x, 0, z); prop.rotation.y = rotation; this.group.add(prop); this.propCount += 1;
    };
    const left = -12.1; const right = 12.1; const back = -8.45; const front = 8.45;

    switch (stage.theme.dressing) {
      case 'ticket-night':
        add(this.ticketBooth(accent, light, dark), left, back, 0.35);
        add(this.turnstile(light, dark), right, -5.3);
        for (const x of [-8, -4, 0, 4, 8]) add(this.pennantPost(x % 8 ? accent : secondary, light), x, back);
        break;
      case 'neon-lab':
        add(this.oscilloscope(accent, light, dark), left, -4.5, Math.PI / 2);
        add(this.oscilloscope(secondary, light, dark), right, 3.8, -Math.PI / 2);
        for (const x of [-8, -4, 0, 4, 8]) add(this.circuitPylon(x % 8 ? accent : secondary, light), x, back);
        break;
      case 'radio-club':
        add(this.radioTower(accent, light, dark), left, -2.5);
        add(this.radioTower(secondary, light, dark), right, 2.8);
        for (const x of [-7, 0, 7]) add(this.speakerStack(dark, accent), x, back);
        break;
      case 'cafe-date':
        for (const x of [-8, -3, 3, 8]) add(this.cafeTable(accent, secondary, light), x, back);
        add(this.cafeSign(accent, light, dark), left, 1.5, Math.PI / 2);
        add(this.cafeSign(secondary, light, dark), right, -2.5, -Math.PI / 2);
        break;
      case 'sponsors-cup':
        add(this.trophyPodium(accent, light, dark), 0, back);
        add(this.cameraRig(dark, secondary), left, -3, Math.PI / 2);
        add(this.cameraRig(dark, secondary), right, 3, -Math.PI / 2);
        for (const x of [-7, 7]) add(this.bannerArch(accent, secondary), x, back);
        break;
      case 'after-hours':
        add(this.generator(accent, light, dark), left, -2, Math.PI / 2);
        add(this.toolCart(secondary, dark), right, 3, -Math.PI / 2);
        for (const x of [-8, -4, 0, 4, 8]) add(this.workLamp(light, dark), x, back);
        break;
      case 'blackout':
        for (const x of [-8, -4, 0, 4, 8]) add(this.stormBeacon(x % 8 ? accent : secondary, light, dark), x, back);
        add(this.transformer(accent, light, dark), left, 2, Math.PI / 2);
        add(this.transformer(secondary, light, dark), right, -2, -Math.PI / 2);
        break;
      case 'school-fair':
        add(this.noticeBoard(accent, light, dark), left, -2, Math.PI / 2);
        add(this.noticeBoard(secondary, light, dark), right, 2, -Math.PI / 2);
        for (const x of [-7, -2.4, 2.4, 7]) add(this.schoolStall(x < 0 ? accent : secondary, light), x, back);
        break;
      case 'sunset':
        for (const x of [-8, -4, 0, 4, 8]) add(this.paperLantern(x % 8 ? accent : secondary, light), x, back);
        add(this.parkBench(accent, dark), left, 3, Math.PI / 2);
        add(this.parkBench(secondary, dark), right, -3, -Math.PI / 2);
        break;
      case 'grand-finale':
        add(this.marqueeArch(accent, secondary, light, dark), 0, back);
        for (const [x, z] of [[left,-4],[left,4],[right,-4],[right,4]] as const) add(this.fireworkStand(accent, secondary, light, dark), x, z);
        add(this.bandstand(accent, secondary, dark), 0, front);
        break;
    }
  }

  update(delta: number, elapsed: number): void {
    for (const item of this.animated) {
      if (item.mode === 'turn') item.object.rotation.y += delta * item.speed;
      else if (item.mode === 'sway') item.object.rotation.z = Math.sin(elapsed * item.speed + item.phase) * 0.1;
      else item.object.scale.setScalar(1 + Math.sin(elapsed * item.speed + item.phase) * 0.08);
    }
  }

  get diagnostics(): StageDressingDiagnostics {
    let meshes = 0; this.group.traverse((object) => { if (object instanceof THREE.Mesh) meshes += 1; });
    return { theme: this.currentTheme, props: this.propCount, meshes, geometries: this.geometries.size, materials: this.materials.size };
  }

  dispose(): void { this.clear(); }

  private clear(): void {
    this.group.clear(); this.animated = []; this.propCount = 0;
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.geometries.clear(); this.materials.clear();
  }

  private mat(color: string, roughness: number, metalness: number) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(m); return m;
  }
  private glow(color: string) {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.25, roughness: 0.28 }); this.materials.add(m); return m;
  }
  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
    this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; return mesh;
  }
  private box(x: number, y: number, z: number, material: THREE.Material) { return this.mesh(new THREE.BoxGeometry(x, y, z), material); }
  private cylinder(rt: number, rb: number, h: number, material: THREE.Material, segments = 12) { return this.mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material); }
  private prop(...objects: THREE.Object3D[]) {
    const group = new THREE.Group();
    if (objects.length > 0) group.add(...objects);
    return group;
  }

  private ticketBooth(a: THREE.Material, l: THREE.Material, d: THREE.Material) { const b=this.box(2.2,2,1.2,a);b.position.y=1;const w=this.box(1.3,.65,.08,d);w.position.set(0,1.25,.64);const s=this.box(1.7,.35,.12,l);s.position.set(0,2.2,.2);return this.prop(b,w,s); }
  private turnstile(l: THREE.Material,d: THREE.Material) { const p=this.cylinder(.1,.14,1.5,d);p.position.y=.75;const arms=this.prop(...[0,1,2].map(i=>{const m=this.box(1.2,.07,.07,l);m.rotation.y=i*Math.PI/3;return m;}));arms.position.y=1.1;this.animated.push({object:arms,speed:1,phase:0,mode:'turn'});return this.prop(p,arms); }
  private pennantPost(a: THREE.Material,l: THREE.Material) { const p=this.cylinder(.05,.08,2.8,l);p.position.y=1.4;const f=this.mesh(new THREE.ConeGeometry(.35,.75,3),a);f.position.set(.3,2.35,0);f.rotation.z=-Math.PI/2;this.animated.push({object:f,speed:1.5,phase:this.propCount,mode:'sway'});return this.prop(p,f); }
  private oscilloscope(a: THREE.Material,l: THREE.Material,d: THREE.Material) { const b=this.box(1.8,1.3,.8,d);b.position.y=.7;const screen=this.box(1.25,.7,.05,a);screen.position.set(0,.85,.43);const dot=this.mesh(new THREE.TorusGeometry(.25,.035,6,20),l);dot.position.set(0,.85,.47);this.animated.push({object:dot,speed:3,phase:0,mode:'pulse'});return this.prop(b,screen,dot); }
  private circuitPylon(a: THREE.Material,l: THREE.Material) { const p=this.box(.22,2,.22,a);p.position.y=1;const nodes=[.4,1,1.6].map((y,i)=>{const n=this.mesh(new THREE.OctahedronGeometry(.16),l);n.position.set(i%2?.22:-.22,y,0);return n;});return this.prop(p,...nodes); }
  private radioTower(a: THREE.Material,l: THREE.Material,d: THREE.Material) { const mast=this.cylinder(.06,.18,4,d);mast.position.y=2;const rings=[1.5,2.5,3.5].map(y=>{const r=this.mesh(new THREE.TorusGeometry(.5,.045,6,24),a);r.position.y=y;r.rotation.x=Math.PI/2;return r;});const beacon=this.mesh(new THREE.SphereGeometry(.13,8,6),l);beacon.position.y=4.1;this.animated.push({object:beacon,speed:4,phase:0,mode:'pulse'});return this.prop(mast,...rings,beacon); }
  private speakerStack(d: THREE.Material,a: THREE.Material) { const g=this.prop();for(let y=0;y<2;y++){const b=this.box(1.2,1,.65,d);b.position.y=.5+y;const c=this.cylinder(.25,.32,.08,a,18);c.rotation.x=Math.PI/2;c.position.set(0,.5+y,.37);g.add(b,c);}return g; }
  private cafeTable(a: THREE.Material,s: THREE.Material,l: THREE.Material) { const top=this.cylinder(.75,.75,.1,a,20);top.position.y=1;const leg=this.cylinder(.08,.22,1,s);leg.position.y=.5;const lamp=this.mesh(new THREE.SphereGeometry(.12,10,6),l);lamp.position.y=1.3;return this.prop(top,leg,lamp); }
  private cafeSign(a: THREE.Material,l: THREE.Material,d: THREE.Material) { const post=this.cylinder(.08,.13,2.5,d);post.position.y=1.25;const sign=this.mesh(new THREE.TorusGeometry(.6,.12,8,24),a);sign.position.y=2.1;const bulb=this.mesh(new THREE.SphereGeometry(.18,10,8),l);bulb.position.y=2.1;return this.prop(post,sign,bulb); }
  private trophyPodium(a: THREE.Material,l: THREE.Material,d: THREE.Material) { const base=this.box(3,1,.9,d);base.position.y=.5;const cup=this.cylinder(.65,.3,1,a,16);cup.position.y=1.5;const star=this.mesh(new THREE.OctahedronGeometry(.3),l);star.position.y=2.35;this.animated.push({object:star,speed:1.4,phase:0,mode:'turn'});return this.prop(base,cup,star); }
  private cameraRig(d: THREE.Material,a: THREE.Material) { const tripod=this.cylinder(.08,.3,1.5,d);tripod.position.y=.75;const camera=this.box(1,.6,.8,a);camera.position.y=1.75;const lens=this.cylinder(.24,.3,.35,d,18);lens.rotation.x=Math.PI/2;lens.position.set(0,1.75,.55);return this.prop(tripod,camera,lens); }
  private bannerArch(a: THREE.Material,s: THREE.Material) { const posts=[-1,1].map(x=>{const p=this.box(.18,3,.18,a);p.position.set(x,1.5,0);return p;});const bar=this.box(2.2,.5,.16,s);bar.position.y=2.7;return this.prop(...posts,bar); }
  private generator(a: THREE.Material,l: THREE.Material,d: THREE.Material) { const b=this.box(2,1.2,1,d);b.position.y=.7;for(const x of [-.65,.65]){const wheel=this.mesh(new THREE.TorusGeometry(.28,.09,8,18),a);wheel.position.set(x,.25,.58);b.add(wheel);}const lamp=this.box(1.4,.1,.05,l);lamp.position.set(0,1,.53);return this.prop(b,lamp); }
  private toolCart(a: THREE.Material,d: THREE.Material) { const b=this.box(1.7,1,.7,a);b.position.y=.7;const h=this.mesh(new THREE.TorusGeometry(.65,.05,6,20,Math.PI),d);h.position.y=1.4;return this.prop(b,h); }
  private workLamp(l: THREE.Material,d: THREE.Material) { const p=this.cylinder(.05,.12,2.2,d);p.position.y=1.1;const lamp=this.mesh(new THREE.ConeGeometry(.3,.45,12),l);lamp.rotation.z=Math.PI;lamp.position.y=2.1;return this.prop(p,lamp); }
  private stormBeacon(a: THREE.Material,l: THREE.Material,d: THREE.Material) { const p=this.cylinder(.1,.2,2,d);p.position.y=1;const cage=this.mesh(new THREE.CylinderGeometry(.25,.3,.7,8,1,true),a);cage.position.y=2;const lamp=this.mesh(new THREE.SphereGeometry(.18,10,8),l);lamp.position.y=2;this.animated.push({object:lamp,speed:5,phase:this.propCount,mode:'pulse'});return this.prop(p,cage,lamp); }
  private transformer(a: THREE.Material,l: THREE.Material,d: THREE.Material) { const b=this.box(1.7,1.7,1,d);b.position.y=.85;const coils=[-.45,.45].map(x=>{const c=this.mesh(new THREE.TorusKnotGeometry(.23,.05,40,6),a);c.position.set(x,1.9,0);return c;});const bolt=this.mesh(new THREE.OctahedronGeometry(.2),l);bolt.position.y=2.5;this.animated.push({object:bolt,speed:4,phase:0,mode:'pulse'});return this.prop(b,...coils,bolt); }
  private noticeBoard(a: THREE.Material,l: THREE.Material,d: THREE.Material) { const board=this.box(2.4,1.6,.15,a);board.position.y=1.5;for(const [x,y] of [[-.6,1.7],[.4,1.4],[0,2]] as const){const note=this.box(.5,.35,.03,l);note.position.set(x,y,.1);board.add(note);}const legs=[-.8,.8].map(x=>{const p=this.box(.12,2,.12,d);p.position.set(x,1,0);return p;});return this.prop(board,...legs); }
  private schoolStall(a: THREE.Material,l: THREE.Material) { const table=this.box(2,1,.8,a);table.position.y=.5;const roof=this.mesh(new THREE.ConeGeometry(1.5,.75,4),l);roof.rotation.y=Math.PI/4;roof.position.y=2.2;const posts=[-1,1].map(x=>{const p=this.box(.08,1.6,.08,a);p.position.set(x,1.4,0);return p;});return this.prop(table,roof,...posts); }
  private paperLantern(a: THREE.Material,l: THREE.Material) { const cord=this.cylinder(.025,.025,1,a,6);cord.position.y=2.5;const lamp=this.mesh(new THREE.SphereGeometry(.35,10,8),l);lamp.scale.y=1.25;lamp.position.y=1.5;this.animated.push({object:lamp,speed:1.2,phase:this.propCount,mode:'sway'});return this.prop(cord,lamp); }
  private parkBench(a: THREE.Material,d: THREE.Material) { const seat=this.box(2.2,.18,.65,a);seat.position.y=.65;const back=this.box(2.2,.8,.14,a);back.position.set(0,1.1,-.28);const legs=[-.7,.7].map(x=>{const p=this.box(.12,.65,.12,d);p.position.set(x,.32,0);return p;});return this.prop(seat,back,...legs); }
  private marqueeArch(a: THREE.Material,s: THREE.Material,l: THREE.Material,d: THREE.Material) { const posts=[-4,4].map(x=>{const p=this.box(.5,5,.5,d);p.position.set(x,2.5,0);return p;});const sign=this.box(8.7,1.3,.35,a);sign.position.y=4.6;for(let x=-3.8;x<=3.8;x+=.55){const bulb=this.mesh(new THREE.SphereGeometry(.07,6,4),l);bulb.position.set(x,4.15,.22);sign.add(bulb);}const crest=this.mesh(new THREE.TorusGeometry(1.1,.18,8,30,Math.PI),s);crest.position.y=5.25;return this.prop(...posts,sign,crest); }
  private fireworkStand(a: THREE.Material,s: THREE.Material,l: THREE.Material,d: THREE.Material) { const base=this.box(1.2,.7,1,d);base.position.y=.35;for(let i=0;i<3;i++){const rocket=this.cylinder(.06,.09,1.5,i%2?a:s,8);rocket.position.set((i-1)*.3,1.2,0);const tip=this.mesh(new THREE.ConeGeometry(.13,.3,8),l);tip.position.set((i-1)*.3,2,0);base.add(rocket,tip);}return this.prop(base); }
  private bandstand(a: THREE.Material,s: THREE.Material,d: THREE.Material) { const stage=this.cylinder(2.2,2.5,.6,d,20);stage.position.y=.3;for(const x of [-1,0,1]){const drum=this.cylinder(.35,.35,.45,x===0?a:s,16);drum.rotation.z=Math.PI/2;drum.position.set(x,.9,0);stage.add(drum);}return this.prop(stage); }
}
