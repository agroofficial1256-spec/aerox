(function(){
"use strict";

// --- PERSISTENT SAVE DATA & DASHBOARD ---
const defaultData = {
    bestDistance: 0, lastDistance: 0, totalFlights: 0,
    unlockedSunset: false, unlockedAurora: false, selectedColor: 'white',
    audio: { guide: true, music: true }, leaderboard: []
};

let savedDataRaw = JSON.parse(localStorage.getItem('aerox_save_data')) || {};
let saveData = { ...defaultData, ...savedDataRaw };

const GARDEN_STORAGE_KEY = 'aerox_crash_garden';
const GARDEN_ID_KEY = 'aerox_garden_id';
const MAX_GARDEN_SIZE = 300;

function makeGardenId(prefix) {
    const randomPart = window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return `${prefix}_${randomPart}`;
}

let gardenId = localStorage.getItem(GARDEN_ID_KEY);
if (!gardenId) {
    gardenId = makeGardenId('garden');
    localStorage.setItem(GARDEN_ID_KEY, gardenId);
}

function readLocalGarden() {
    try {
        const records = JSON.parse(localStorage.getItem(GARDEN_STORAGE_KEY) || '[]');
        return Array.isArray(records) ? records.filter(record =>
            record && typeof record.id === 'string' && Number.isFinite(record.x) && Number.isFinite(record.z)
        ).slice(-MAX_GARDEN_SIZE) : [];
    } catch (error) {
        return [];
    }
}

let crashGarden = readLocalGarden();

function persistLocalGarden() {
    localStorage.setItem(GARDEN_STORAGE_KEY, JSON.stringify(crashGarden.slice(-MAX_GARDEN_SIZE)));
}

if (!saveData.audio) saveData.audio = defaultData.audio;
if (!saveData.leaderboard) saveData.leaderboard = defaultData.leaderboard;

// --- BACKGROUND MUSIC (music.mp3) ---

const bgMusic = new Audio('music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.5;

function updateMusicState() {
    if (saveData.audio.music && state.running) {
        bgMusic.play().catch(e => console.log("Audio autoplay waiting for interaction"));
    } else {
        bgMusic.pause();
    }
}

// --- AUDIO CONTROLS UI WIRING ---
const btnGuide = document.getElementById('toggleGuide');
const btnMusic = document.getElementById('toggleMusic');

function updateAudioUI() {
    btnGuide.textContent = saveData.audio.guide ? 'ON' : 'OFF';
    btnGuide.className = 'audio-btn-toggle' + (saveData.audio.guide ? ' active' : '');
    
    btnMusic.textContent = saveData.audio.music ? 'ON' : 'OFF';
    btnMusic.className = 'audio-btn-toggle' + (saveData.audio.music ? ' active' : '');
}
updateAudioUI();

document.getElementById('audioBtn').addEventListener('click', () => {
    document.getElementById('audioControls').classList.toggle('show');
});

btnGuide.addEventListener('click', () => {
    saveData.audio.guide = !saveData.audio.guide;
    saveProgress();
    updateAudioUI();
});

btnMusic.addEventListener('click', () => {
    saveData.audio.music = !saveData.audio.music;
    saveProgress();
    updateAudioUI();
    updateMusicState();
});

// --- GOOGLE HINDI / INDIAN ACCENT TTS (GUIDE) ---
function speak(text){
    if (!saveData.audio.guide) return;
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05; u.pitch = 0.9; u.volume = 0.9;
    
    const voices = window.speechSynthesis.getVoices();
    const googleVoice = voices.find(v => v.name.includes('Google') && (v.lang.includes('hi') || v.lang.includes('IN'))) ||
                        voices.find(v => v.name.includes('Google')) ||
                        voices.find(v => v.lang.includes('hi') || v.lang.includes('IN'));
    if (googleVoice) {
        u.voice = googleVoice;
    }

    window.speechSynthesis.speak(u);
}

function saveProgress() { localStorage.setItem('aerox_save_data', JSON.stringify(saveData)); }

function timeGreeting(){
    const h = new Date().getHours();
    const part = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
    return saveData.totalFlights > 0 ? `Good ${part}, Pilot! Ready for another run?` : `Good ${part}! Take your first flight, Pilot.`;
}

function updateDashboardUI() {
    document.getElementById('greeting').textContent = timeGreeting();
    document.getElementById('dashBest').textContent = Math.floor(saveData.bestDistance) + 'm';
    document.getElementById('dashLast').textContent = Math.floor(saveData.lastDistance) + 'm';
    document.getElementById('dashFlights').textContent = saveData.totalFlights;
    document.getElementById('dashGarden').textContent = crashGarden.length;
    
    let unlockedCount = 1;
    if(saveData.unlockedSunset) { unlockedCount++; document.getElementById('btnSunset').classList.remove('locked'); }
    if(saveData.unlockedAurora) { unlockedCount++; document.getElementById('btnAurora').classList.remove('locked'); }
    document.getElementById('dashUnlocked').textContent = unlockedCount + ' / 3';

    const progLabel = document.getElementById('unlockProgressLabel');
    const progFill = document.getElementById('unlockProgressFill');
    if (!saveData.unlockedSunset) {
        const pct = Math.min(100, (saveData.bestDistance / 1000) * 100);
        progLabel.textContent = `${Math.max(0, Math.ceil(1000 - saveData.bestDistance))}m to Sunset Gradient`;
        progFill.style.width = pct + '%';
    } else if (!saveData.unlockedAurora) {
        const pct = Math.min(100, (saveData.bestDistance / 5000) * 100);
        progLabel.textContent = `${Math.max(0, Math.ceil(5000 - saveData.bestDistance))}m to Aurora Gradient`;
        progFill.style.width = pct + '%';
    } else {
        progLabel.textContent = 'All gradients unlocked!';
        progFill.style.width = '100%';
    }

    document.querySelectorAll('.color-btn').forEach(b => {
        b.classList.toggle('selected', b.getAttribute('data-color') === saveData.selectedColor);
    });
}
updateDashboardUI();

// Color selection handler
function showLockMessage(msg){
    const el = document.getElementById('lockMsg');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(()=> el.classList.remove('show'), 2500);
}
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const colorKey = btn.getAttribute('data-color');
        if(colorKey === 'sunset' && !saveData.unlockedSunset) { showLockMessage('🔒 Fly 1,000m in one run to unlock Sunset.'); return; }
        if(colorKey === 'aurora' && !saveData.unlockedAurora) { showLockMessage('🔒 Fly 5,000m in one run to unlock Aurora.'); return; }
        
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        saveData.selectedColor = colorKey;
        saveProgress();
        switchActivePlane(colorKey);
    });
});

const scene = new THREE.Scene();

const skyColor = new THREE.Color(0x5a9ad4); 
scene.background = skyColor;
scene.fog = new THREE.FogExp2(skyColor, 0.0015); 

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 2000); 

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio * 1.5, 3)); 
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35; 
const container = document.getElementById('gameContainerModal') || document.body;
container.appendChild(renderer.domElement);

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.35); 
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xe6f2ff, 0x2b3d2b, 0.5); 
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfffae6, 2.5); 
keyLight.position.set(-60, 120, -40);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048); 
keyLight.shadow.camera.near = 0.5;

keyLight.shadow.camera.far = 1200; 
const d = 400; 
keyLight.shadow.camera.left = -d;
keyLight.shadow.camera.right = d;
keyLight.shadow.camera.top = d;
keyLight.shadow.camera.bottom = -d;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);
scene.add(keyLight.target);

const bounceLight = new THREE.DirectionalLight(0x7da87d, 0.4); 
bounceLight.position.set(50, -50, 30);
scene.add(bounceLight);

const rimLight = new THREE.PointLight(0xffddaa, 1.5, 50);
scene.add(rimLight); 

const envPalettes = [
    { bg: 0x5a9ad4, hemiSky: 0xe6f2ff, hemiGround: 0x2b3d2b }, 
    { bg: 0xff7b54, hemiSky: 0xffd5a1, hemiGround: 0x543a2a }, 
    { bg: 0x121a2f, hemiSky: 0x4a5a7a, hemiGround: 0x1a2b3c }, 
];

// --- NOISE UTILITIES ---
const noise2D = (function() {
    function hash(x, y) {
        let h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return h - Math.floor(h);
    }
    function mix(a, b, t) { return a * (1 - t) + b * t; }
    return function(x, y) {
        let xi = Math.floor(x), yi = Math.floor(y);
        let xf = x - xi, yf = y - yi;
        let u = xf * xf * (3.0 - 2.0 * xf);
        let v = yf * yf * (3.0 - 2.0 * yf);
        let a = hash(xi, yi), b = hash(xi + 1, yi);
        let c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
        return mix(mix(a, b, u), mix(c, d, u), v);
    };
})();
function fbm(x, y, octaves) {
    let v = 0, a = 0.5, shift = 100.0;
    for (let i = 0; i < octaves; ++i) {
        v += a * noise2D(x, y);
        x = x * 2.0 + shift; y = y * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

// --- DYNAMIC AIRPLANE TEXTURES / MATERIALS ---
function createColorTexture(type) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    
    if (type === 'sunset') {
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0, '#e8380d');
        grad.addColorStop(1, '#ff9a1f');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);
    } else if (type === 'aurora') {
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0, '#0d3b2e');
        grad.addColorStop(0.5, '#12575c');
        grad.addColorStop(1, '#2e1065');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 512, 512);
    }
    
    const imgData = ctx.getImageData(0,0,512,512);
    for(let i=0; i<imgData.data.length; i+=4) {
        const noise = (Math.random() - 0.5) * 12;
        imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + noise));
        imgData.data[i+1] = Math.min(255, Math.max(0, imgData.data[i+1] + noise));
        imgData.data[i+2] = Math.min(255, Math.max(0, imgData.data[i+2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
}

const planeMaterials = {
  white: new THREE.MeshPhysicalMaterial({ map: createColorTexture('white'), roughness:0.9, metalness:0.0, clearcoat:0.1, clearcoatRoughness:0.8, side: THREE.DoubleSide, flatShading:true }),
  sunset: new THREE.MeshPhysicalMaterial({ map: createColorTexture('sunset'), roughness:0.9, metalness:0.0, clearcoat:0.1, clearcoatRoughness:0.8, side: THREE.DoubleSide, flatShading:true }),
  aurora: new THREE.MeshPhysicalMaterial({ map: createColorTexture('aurora'), roughness:0.9, metalness:0.0, clearcoat:0.1, clearcoatRoughness:0.8, side: THREE.DoubleSide, flatShading:true })
};

function buildAirplaneGeometry(){
  const geo = new THREE.BufferGeometry();
  const vertices = new Float32Array([
     0.00, 0.13, -1.72,  -0.38, 0.12, 0.16,  -1.48, -0.03, 0.94,
     0.00, 0.13, -1.72,  -1.48, -0.03, 0.94,  -0.09, 0.17, 1.24,
     0.00, 0.13, -1.72,  -0.09, 0.17, 1.24,   0.00, 0.24, 0.10,
     0.00, 0.13, -1.72,   0.00, 0.24, 0.10,   0.09, 0.17, 1.24,
     0.00, 0.13, -1.72,   0.09, 0.17, 1.24,   1.48, -0.03, 0.94,
     0.00, 0.13, -1.72,   1.48, -0.03, 0.94,   0.38, 0.12, 0.16,
     0.00, 0.13, -1.72,   0.00, -0.34, 1.17,  -0.09, 0.17, 1.24,
     0.00, 0.13, -1.72,   0.09, 0.17, 1.24,   0.00, -0.34, 1.17,
    -1.48, -0.03, 0.94,  -1.34, 0.10, 1.31,  -0.09, 0.17, 1.24,
     1.48, -0.03, 0.94,   0.09, 0.17, 1.24,   1.34, 0.10, 1.31
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const uvs = new Float32Array((vertices.length / 3) * 2);
  for (let i = 0; i < vertices.length / 3; i++) {
    const x = vertices[i * 3]; const z = vertices[i * 3 + 2];
    uvs[i * 2] = (x + 1.5) / 3.0; uvs[i * 2 + 1] = (z + 1.7) / 3.1;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}
const airplaneGeometry = buildAirplaneGeometry();

function buildAirplaneCreases(){
  const creaseGeometry = new THREE.BufferGeometry();
  creaseGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
     0.00, 0.252, 0.10,   -0.09, 0.182, 1.24,
     0.00, 0.252, 0.10,    0.09, 0.182, 1.24,
     0.00, 0.145, -1.72,  -0.38, 0.132, 0.16,
    -0.38, 0.132, 0.16,   -1.46, -0.018, 0.94,
     0.00, 0.145, -1.72,   0.38, 0.132, 0.16,
     0.38, 0.132, 0.16,    1.46, -0.018, 0.94,
    -0.38, 0.132, 0.16,   -0.09, 0.182, 1.24,
     0.38, 0.132, 0.16,    0.09, 0.182, 1.24
  ], 3));
  return creaseGeometry;
}
const airplaneCreaseGeometry = buildAirplaneCreases();
const airplaneCreaseMaterial = new THREE.LineBasicMaterial({ color:0x6f624f, transparent:true, opacity:0.58 });

function buildBoatGeometry(){
  const geo = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0, -0.5, -1.2,  1.0, 0.5, 1.0,  -1.0, 0.5, 1.0, 
    0, -0.5, -1.2,  0, 1.5, 0.2,   1.0, 0.5, 1.0,   
    0, -0.5, -1.2, -1.0, 0.5, 1.0, 0, 1.5, 0.2      
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const uvs = new Float32Array((vertices.length / 3) * 2);
  for (let i = 0; i < vertices.length / 3; i++) {
    uvs[i * 2] = 0.5; uvs[i * 2 + 1] = 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals(); return geo;
}
const boatGeometry = buildBoatGeometry();

function buildEntity(geo, material, showPaperCreases = false){
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  if(showPaperCreases) {
    const creases = new THREE.LineSegments(airplaneCreaseGeometry, airplaneCreaseMaterial);
    creases.renderOrder = 2;
    group.add(creases);
  }
  group.userData.mesh = mesh; group.userData.radius = 1.0;
  return group;
}

const planes = {
  white: buildEntity(airplaneGeometry, planeMaterials.white, true), sunset: buildEntity(airplaneGeometry, planeMaterials.sunset, true), aurora: buildEntity(airplaneGeometry, planeMaterials.aurora, true)
};
const boats = {
  white: buildEntity(boatGeometry, planeMaterials.white), sunset: buildEntity(boatGeometry, planeMaterials.sunset), aurora: buildEntity(boatGeometry, planeMaterials.aurora)
};
Object.values(planes).forEach(p => { scene.add(p); p.visible = false; });
Object.values(boats).forEach(b => { scene.add(b); b.visible = false; });

let plane = planes[saveData.selectedColor] || planes.white;
let boat = boats[saveData.selectedColor] || boats.white;
let currentEntity = plane;
plane.visible = true;

function switchActivePlane(colorKey){
  if (currentEntity === plane) { plane.visible = false; plane = planes[colorKey]; plane.visible = true; currentEntity = plane; }
  else { boat.visible = false; boat = boats[colorKey]; boat.visible = true; currentEntity = boat; }
  ball.material = planeMaterials[colorKey];
}

const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 3), planeMaterials[saveData.selectedColor] || planeMaterials.white);
ball.castShadow = true; ball.visible = false; scene.add(ball);

// --- POETRY IN MOTION: WING TRAILS ---
const maxTrail = 100;
const trailGeo1 = new THREE.BufferGeometry(); const trailGeo2 = new THREE.BufferGeometry();
const trailPos1 = new Float32Array(maxTrail * 3); const trailPos2 = new Float32Array(maxTrail * 3);
trailGeo1.setAttribute('position', new THREE.BufferAttribute(trailPos1, 3));
trailGeo2.setAttribute('position', new THREE.BufferAttribute(trailPos2, 3));
const trailMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
const trail1 = new THREE.Line(trailGeo1, trailMat); const trail2 = new THREE.Line(trailGeo2, trailMat);
scene.add(trail1); scene.add(trail2);
let trailIndex = 0;

// --- GROUND & ENVIRONMENT ---
function makeUltraGroundTexture(){
  const c = document.createElement('canvas');
  c.width = c.height = 1024; 
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(1024, 1024);
  const data = imgData.data;

  for(let y=0; y<1024; y++){
    for(let x=0; x<1024; x++){
       let macro = fbm(x*0.02, y*0.02, 5);
       let micro = fbm(x*0.1, y*0.1, 3); 
       
       let r, g, b;
       if(macro > 0.6) {
           r = 25 + micro*20; g = 115 + micro*40; b = 30 + micro*15;
       } else {
           r = 15 + micro*10; g = 145 + macro*50; b = 25 + micro*25;
       }

       const idx = (y*1024 + x)*4;
       data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 50);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}
const groundTex = makeUltraGroundTexture();

const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x4aa6d2, metalness: 0.9, roughness: 0.05, transmission: 0.85, ior: 1.33, 
    transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
});

const ALT_MIN = 1.0, ALT_MAX = 35; 
const TILE_LEN = 300; const TILE_W = 2000; 
const groundTiles = [];

const grassUniforms = {
    time: { value: 0 },
    wind: { value: 0 }
};

const grassMaterial = new THREE.MeshStandardMaterial({
    color: 0x718653,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    flatShading: true
});

grassMaterial.onBeforeCompile = shader => {
    shader.uniforms.uGrassTime = grassUniforms.time;
    shader.uniforms.uGrassWind = grassUniforms.wind;
    shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
            uniform float uGrassTime;
            uniform float uGrassWind;
            varying float vPaperCrease;
        `)
        .replace('#include <begin_vertex>', `
            vec3 transformed = vec3(position);
            vec3 tuftPosition = instanceMatrix[3].xyz;
            float bladeTip = smoothstep(0.02, 0.82, position.y);
            float phase = tuftPosition.x * 0.075 + tuftPosition.z * 0.11;
            float fieldWave = sin(uGrassTime * 2.15 + phase) * 0.62 + sin(uGrassTime * 0.9 + phase * 1.7) * 0.38;
            float windAmount = abs(uGrassWind);
            float windDirection = uGrassWind == 0.0 ? 0.0 : sign(uGrassWind);
            transformed.x += bladeTip * bladeTip * (uGrassWind * 0.52 + fieldWave * (0.025 + windAmount * 0.09) * windDirection);
            transformed.z += bladeTip * fieldWave * (0.018 + windAmount * 0.045);
            vPaperCrease = bladeTip + position.x * 2.8;
        `);
    shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
            varying float vPaperCrease;
        `)
        .replace('#include <color_fragment>', `#include <color_fragment>
            float creaseLine = 1.0 - smoothstep(0.0, 0.035, abs(fract(vPaperCrease * 1.7) - 0.5));
            diffuseColor.rgb *= mix(vec3(0.82, 0.88, 0.72), vec3(0.62, 0.72, 0.48), creaseLine * 0.24);
        `);
};
grassMaterial.customProgramCacheKey = () => 'aerox-paper-grass-v1';

function buildGrassForTile(width, length) {
    const count = 10500; 
    const grassGeo = new THREE.BufferGeometry();
    const gVerts = new Float32Array([
        -0.10, 0, 0,   0.10, 0, 0,   -0.075, 0.42, 0.02,   0.075, 0.42, 0.02,   0.015, 0.84, -0.08,
         0, 0, -0.09,  0, 0, 0.09,   0.02, 0.38, -0.07,    0.02, 0.38, 0.07,   -0.06, 0.72, 0.02
    ]);
    grassGeo.setAttribute('position', new THREE.BufferAttribute(gVerts, 3));
    grassGeo.setIndex([0,1,2, 1,3,2, 2,3,4, 5,6,7, 6,8,7, 7,8,9]);
    grassGeo.computeVertexNormals();

    const instMesh = new THREE.InstancedMesh(grassGeo, grassMaterial, count);
    const dummy = new THREE.Object3D();
    
    for(let i=0; i<count; i++){
        let x = (Math.random() - 0.5) * width;
        let z = (Math.random() - 0.5) * length;
        let y = (Math.random() - 0.5) * 0.1;
        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.scale.set(0.75 + Math.random()*0.65, 0.75 + Math.random()*1.1, 0.75 + Math.random()*0.65);
        dummy.updateMatrix();
        instMesh.setMatrixAt(i, dummy.matrix);
    }
    instMesh.receiveShadow = true;
    instMesh.frustumCulled = false;
    return instMesh;
}

function makeGroundTile(){
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(TILE_W, TILE_LEN, 64, 32);
  geo.rotateX(-Math.PI/2);
  
  const pos = geo.attributes.position;
  for(let i=0; i<pos.count; i++) {
     pos.setY(i, (Math.random()-0.5)*0.8);  
  }
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: groundTex, roughness:0.85 }));
  mesh.receiveShadow = true;
  group.add(mesh);

  // Dynamic Ponds
  group.userData.ponds = [];
  const numPonds = 6 + Math.random()*8;
  for(let p=0; p<numPonds; p++){
      const r = 10 + Math.random()*50; 
      const px = (Math.random()-0.5)*800;
      const pz = (Math.random()-0.5)*TILE_LEN;
      const wMesh = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI/2), waterMat);
      
      wMesh.position.set(px, 0.45 + (p * 0.01), pz);
      group.add(wMesh);
      group.userData.ponds.push({ x: px, z: pz, r: r, mesh: wMesh });
  }

  group.add(buildGrassForTile(800, TILE_LEN));
  scene.add(group);
  return group;
}

for(let i=0;i<4;i++){
  const tile = makeGroundTile();
  tile.position.z = -i*TILE_LEN;
  groundTiles.push(tile);
}

const obstacles = [];
const dynamicEntities = [];
let nextSpawnAt = 30;

// --- OBSTACLES (EXPANDED DIVERSITY) ---
function createLushTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 4.0, 8), new THREE.MeshStandardMaterial({color:0x36251b, roughness:1.0}));
  trunk.position.y = 2.0; trunk.castShadow = true; g.add(trunk);
  
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.9, flatShading: true, emissive: 0x000000 });
  const leavesGroup = new THREE.Group();
  for(let i=0; i<6; i++) {
     const l = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8 + Math.random()*1.5, 1), leafMat);
     l.position.set((Math.random()-0.5)*3.0, 3.5 + Math.random()*4.5, (Math.random()-0.5)*3.0);
     l.castShadow = true; leavesGroup.add(l);
  }
  g.add(leavesGroup);
  g.userData = { width: 7.0, depth: 7.0, height: 9.0, leaves: leafMat };
  return g;
}

function createHighBuilding() {
    const height = 18 + Math.random() * 14;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(6, height, 6).translate(0, height/2, 0), new THREE.MeshStandardMaterial({color: 0x8899aa, roughness: 0.5, emissive: 0x000000}));
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { width: 6, depth: 6, height, leaves: mesh.material };
    return mesh;
}

function create2StoreyBuilding() {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 10).translate(0, 10, 0), new THREE.MeshStandardMaterial({color: 0xc4b7a6, roughness: 0.7, emissive: 0x000000}));
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { width: 10, depth: 10, height: 20, leaves: mesh.material };
    return mesh;
}

function createTower() {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3.0, 30, 12).translate(0, 15, 0), new THREE.MeshStandardMaterial({color: 0x444444, roughness: 0.6, emissive: 0x000000}));
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { width: 4, depth: 4, height: 30, leaves: mesh.material };
    return mesh;
}

function createSchool() {
    const g = new THREE.Group();
    const mainMat = new THREE.MeshStandardMaterial({color: 0xb55a5a, roughness: 0.8, emissive: 0x000000});
    const main = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 14).translate(0, 6, 0), mainMat);
    main.castShadow = true; g.add(main);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(25, 1, 15).translate(0, 12.5, 0), new THREE.MeshStandardMaterial({color: 0x333333, roughness: 0.9}));
    roof.castShadow = true; g.add(roof);
    g.userData = { width: 24, depth: 14, height: 13, leaves: mainMat };
    return g;
}

function createFactory() {
    const g = new THREE.Group();
    const mainMat = new THREE.MeshStandardMaterial({color: 0x555555, roughness: 0.8, emissive: 0x000000});
    const main = new THREE.Mesh(new THREE.BoxGeometry(15, 10, 20).translate(0, 5, 0), mainMat);
    main.castShadow = true; main.receiveShadow = true; g.add(main);
    const smokestack = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2, 18, 8).translate(5, 9, -5), new THREE.MeshStandardMaterial({color: 0x333333, roughness: 0.9}));
    smokestack.castShadow = true; g.add(smokestack);
    g.userData = { width: 15, depth: 20, height: 18, leaves: mainMat };
    return g;
}

function createHouse() {
    const g = new THREE.Group();
    const mainMat = new THREE.MeshStandardMaterial({color: 0xeeddaa, roughness: 0.9, emissive: 0x000000});
    const base = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 10).translate(0, 3, 0), mainMat);
    base.castShadow = true; base.receiveShadow = true; g.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 4, 4).translate(0, 8, 0).rotateY(Math.PI/4), new THREE.MeshStandardMaterial({color: 0x884433, roughness: 0.8}));
    roof.castShadow = true; g.add(roof);
    g.userData = { width: 8, depth: 10, height: 10, leaves: mainMat };
    return g;
}

function createVehicle() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({color: 0xcc3333, roughness: 0.3, metalness: 0.4, emissive: 0x000000});
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.0, 9.0).translate(0, 2.3, 0), bodyMat);
    body.castShadow = true; g.add(body);

    const tireMat = new THREE.MeshStandardMaterial({color: 0x171916, roughness: 0.92, metalness: 0.05});
    const hubMat = new THREE.MeshStandardMaterial({color: 0xb7aa8e, roughness: 0.45, metalness: 0.65});
    const wheelGeometry = new THREE.CylinderGeometry(0.82, 0.82, 0.58, 14).rotateZ(Math.PI / 2);
    const hubGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.62, 12).rotateZ(Math.PI / 2);
    const wheels = [];

    [-1, 1].forEach(side => {
        [-2.85, 2.85].forEach(z => {
            const wheel = new THREE.Mesh(wheelGeometry, tireMat);
            wheel.position.set(side * 1.75, 0.82, z);
            wheel.castShadow = true;
            wheel.receiveShadow = true;
            g.add(wheel);
            wheels.push(wheel);

            const hub = new THREE.Mesh(hubGeometry, hubMat);
            hub.position.set(side * 1.77, 0.82, z);
            hub.castShadow = true;
            g.add(hub);
            wheels.push(hub);
        });
    });

    g.userData = { width: 4.1, depth: 9.0, height: 3.8, isVehicle: true, speed: 18 + Math.random()*12, wheelRadius: 0.82, wheels, leaves: bodyMat };
    return g;
}

function spawnObstacle(zOffset) {
  let mesh;
  const rand = Math.random();
  if (rand < 0.25) mesh = createLushTree();
  else if (rand < 0.40) mesh = createHouse();
  else if (rand < 0.50) mesh = createSchool();
  else if (rand < 0.60) mesh = create2StoreyBuilding(); 
  else if (rand < 0.70) mesh = createFactory();
  else if (rand < 0.80) mesh = createHighBuilding(); 
  else if (rand < 0.90) mesh = createTower();
  else mesh = createVehicle();

  const x = state.x + (Math.random()*160 - 80); 
  const spawnZ = zOffset !== undefined ? zOffset : -1000 - Math.random()*200;
  mesh.position.set(x, 0, spawnZ);
  scene.add(mesh);
  
  obstacles.push({ mesh, width: mesh.userData.width, depth: mesh.userData.depth, height: mesh.userData.height, hit: false, isVehicle: mesh.userData.isVehicle, speed: mesh.userData.speed || 0 });
}

// --- GAME STATE ---
const state = {
  mode: 'fly', isBoat: false, x: 0, y: 12, z: 0, vx: 0, vy: 0, speed: 20, pitch: 0, roll: 0, 
  barrelRolling: false, rollAngle: 0, rollProgress: 0, distance: 0,
  windForce: 0, targetWindForce: 0, windPhase: 0, windTimer: 4, 
  ballVel: new THREE.Vector3(), settleTimer: 0, running: false, gameOver: false, stallState: false, currentLookAt: null,
  crashFinalized: false, crashFocus: null
};

// --- PERSISTENT SUNFLOWER CRASH GARDEN ---
const sunflowerLayer = new THREE.Group();
scene.add(sunflowerLayer);

const sunflowerMeshes = new Map();
const sunflowerMaterials = {
    stem: new THREE.MeshStandardMaterial({ color: 0x557044, roughness: 1, flatShading: true }),
    petal: new THREE.MeshStandardMaterial({ color: 0xe5a72f, roughness: 0.95, flatShading: true }),
    center: new THREE.MeshStandardMaterial({ color: 0x5a3821, roughness: 1, flatShading: true }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x688053, roughness: 1, side: THREE.DoubleSide, flatShading: true })
};
const sunflowerStemGeometry = new THREE.CylinderGeometry(0.035, 0.055, 1.55, 5);
const sunflowerPetalGeometry = new THREE.SphereGeometry(0.22, 5, 3);
const sunflowerCenterGeometry = new THREE.IcosahedronGeometry(0.24, 1);
const sunflowerLeafGeometry = new THREE.BufferGeometry();
sunflowerLeafGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0,  0.34, 0.14, 0.02,  0.08, 0.34, 0,
    0, 0, 0, -0.32, 0.12, -0.02, -0.06, 0.31, 0
]), 3));
sunflowerLeafGeometry.computeVertexNormals();

function createSunflower(record, animateBloom) {
    const flower = new THREE.Group();
    const materialSet = animateBloom ? {
        stem: sunflowerMaterials.stem.clone(),
        petal: sunflowerMaterials.petal.clone(),
        center: sunflowerMaterials.center.clone(),
        leaf: sunflowerMaterials.leaf.clone()
    } : sunflowerMaterials;
    const fadeMaterials = animateBloom ? Object.values(materialSet) : [];
    fadeMaterials.forEach(material => { material.transparent = true; material.opacity = 0; });

    const stem = new THREE.Mesh(sunflowerStemGeometry, materialSet.stem);
    stem.position.y = 0.78;
    stem.castShadow = true;
    flower.add(stem);

    const leaves = new THREE.Mesh(sunflowerLeafGeometry, materialSet.leaf);
    leaves.position.y = 0.55;
    leaves.rotation.x = -0.18;
    flower.add(leaves);

    const bloom = new THREE.Group();
    bloom.position.y = 1.62;
    for (let petalIndex = 0; petalIndex < 12; petalIndex++) {
        const angle = (petalIndex / 12) * Math.PI * 2;
        const petal = new THREE.Mesh(sunflowerPetalGeometry, materialSet.petal);
        petal.scale.set(0.62, 1.28, 0.22);
        petal.position.set(Math.cos(angle) * 0.38, Math.sin(angle) * 0.38, 0);
        petal.rotation.z = angle - Math.PI / 2;
        petal.castShadow = true;
        bloom.add(petal);
    }
    const center = new THREE.Mesh(sunflowerCenterGeometry, materialSet.center);
    center.position.z = 0.08;
    center.scale.set(1, 1, 0.48);
    center.castShadow = true;
    bloom.add(center);
    flower.add(bloom);

    flower.position.set(record.x, 0.42, record.z + state.distance);
    flower.rotation.y = -0.08;
    flower.scale.setScalar(animateBloom ? 0.001 : 1);
    flower.userData = {
        id: record.id,
        routeZ: record.z,
        bloom,
        bloomElapsed: animateBloom ? 0 : 99,
        fadeMaterials
    };
    sunflowerLayer.add(flower);
    sunflowerMeshes.set(record.id, flower);
    return flower;
}

function addCrashMonument(record, animateBloom = false) {
    if (sunflowerMeshes.has(record.id)) return sunflowerMeshes.get(record.id);
    return createSunflower(record, animateBloom);
}

function normalizeMonument(record) {
    if (!record || typeof record.id !== 'string' || !Number.isFinite(Number(record.x)) || !Number.isFinite(Number(record.z))) return null;
    return { id: record.id, x: Number(record.x), z: Number(record.z), createdAt: record.createdAt || new Date().toISOString() };
}

async function syncCrashGarden() {
    crashGarden.forEach(record => addCrashMonument(record));
    updateDashboardUI();
    try {
        const response = await fetch(`/api/crash-garden?gardenId=${encodeURIComponent(gardenId)}`);
        if (!response.ok) return;
        const payload = await response.json();
        const remoteIds = new Set((payload.monuments || []).map(record => record.id));
        const unsyncedRecords = crashGarden.filter(record => !remoteIds.has(record.id));
        if (unsyncedRecords.length) {
            fetch('/api/crash-garden', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gardenId, monuments: unsyncedRecords })
            }).catch(() => console.info('Local crash garden sync is waiting for a connection.'));
        }
        const merged = new Map(crashGarden.map(record => [record.id, record]));
        (payload.monuments || []).forEach(rawRecord => {
            const record = normalizeMonument(rawRecord);
            if (record) merged.set(record.id, record);
        });
        crashGarden = Array.from(merged.values()).slice(-MAX_GARDEN_SIZE);
        persistLocalGarden();
        crashGarden.forEach(record => addCrashMonument(record));
        updateDashboardUI();
    } catch (error) {
        console.info('Crash garden is using its local cache.');
    }
}

function saveCrashMonument(record) {
    crashGarden = crashGarden.filter(item => item.id !== record.id);
    crashGarden.push(record);
    crashGarden = crashGarden.slice(-MAX_GARDEN_SIZE);
    persistLocalGarden();
    updateDashboardUI();
    fetch('/api/crash-garden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...record, gardenId })
    }).catch(() => console.info('Crash monument queued in the local garden.'));
}

function updateSunflowers(dt) {
    sunflowerMeshes.forEach(flower => {
        flower.position.z = flower.userData.routeZ + state.distance;
        flower.visible = Math.abs(flower.position.z) < 1050;
        if (flower.userData.bloomElapsed < 4) {
            flower.userData.bloomElapsed += dt;
            const progress = THREE.MathUtils.clamp((flower.userData.bloomElapsed - 0.28) / 1.35, 0, 1);
            const overshoot = 1 + 1.7 * Math.pow(progress - 1, 3) + 0.7 * Math.pow(progress - 1, 2);
            flower.scale.setScalar(Math.max(0.001, overshoot));
            flower.userData.bloom.rotation.z = (1 - progress) * -0.55;
            flower.userData.fadeMaterials.forEach(material => { material.opacity = progress; });
        }
    });
}

function finalizeCrash() {
    if (state.crashFinalized) return;
    state.crashFinalized = true;
    const record = {
        id: makeGardenId('crash'),
        x: Number(ball.position.x.toFixed(2)),
        z: Number((ball.position.z - state.distance).toFixed(2)),
        createdAt: new Date().toISOString()
    };
    const flower = addCrashMonument(record, true);
    saveCrashMonument(record);
    state.gameOver = true;
    state.running = false;
    state.crashFocus = { flower, elapsed: 0, summaryShown: false };
    setStatus('A sunflower remembers this flight.', 2600, false);
}

function updateCrashCinematic(dt) {
    if (!state.crashFocus) return;
    state.crashFocus.elapsed += dt;
    const flower = state.crashFocus.flower;
    const target = new THREE.Vector3(flower.position.x, 1.35, flower.position.z);
    const cameraOffset = new THREE.Vector3(3.2, 2.5, 5.4);
    camera.up.lerp(new THREE.Vector3(0, 1, 0), Math.min(1, dt * 4));
    camera.position.lerp(target.clone().add(cameraOffset), Math.min(1, dt * 2.4));
    camera.lookAt(target);
    if (state.crashFocus.elapsed > 3 && !state.crashFocus.summaryShown) {
        state.crashFocus.summaryShown = true;
        document.getElementById('finalDistance').textContent = `You flew ${Math.floor(state.distance)} meters. Another sunflower joined your garden.`;
        document.getElementById('crashScreen').classList.add('show');
    }
}

syncCrashGarden();

const keys = {};
window.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

let statusTimer;
function setStatus(msg, ms, isWarning = false){
  const el = document.getElementById('status');
  el.textContent = msg;
  if(isWarning) el.classList.add('warning'); else el.classList.remove('warning');
  el.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(()=> el.classList.remove('show'), ms || 1500);
  speak(msg);
}

function checkUnlocks(newDist) {
    let unlockedNew = false;
    if (newDist >= 1000 && !saveData.unlockedSunset) {
        saveData.unlockedSunset = true; saveData.selectedColor = 'sunset';
        switchActivePlane('sunset'); unlockedNew = true;
        setStatus("Unlocked Sunset Airplane Gradient!", 3500, false);
    }
    if (newDist >= 5000 && !saveData.unlockedAurora) {
        saveData.unlockedAurora = true; saveData.selectedColor = 'aurora';
        switchActivePlane('aurora'); unlockedNew = true;
        setStatus("Unlocked Aurora Airplane Gradient!", 3500, false);
    }
    
    saveData.leaderboard.push({ dist: newDist, date: Date.now() });
    if(newDist > saveData.bestDistance) saveData.bestDistance = newDist;
    saveData.lastDistance = newDist;
    saveData.totalFlights++;
    saveProgress(); updateDashboardUI();
}

function triggerCollision(){
  if(state.mode !== 'fly') return;
  state.mode = 'ball';
  currentEntity.visible = false;
  ball.visible = true;
  ball.position.set(state.x, Math.max(state.y, 0.6), state.z);
  state.ballVel.set(state.vx*1.5 + (Math.random()*4-2), 4+Math.random()*3, state.speed * 0.8);
  state.settleTimer = 0;
  
  checkUnlocks(state.distance);

  bgMusic.pause();

  document.getElementById('windBox').classList.remove('show');
  setStatus('CRASHED! Crumpled and rolling...', 2500, true);
}

function resetGame(){
  state.mode='fly'; state.isBoat=false; state.x=0; state.y=12; state.vx=0; state.vy=0; state.pitch=0; state.roll=0;
  state.barrelRolling = false; state.rollAngle = 0; state.rollProgress = 0;
  state.speed=20; state.distance=0; state.gameOver=false; state.stallState=false;
  state.windForce = 0; state.targetWindForce = 0; state.windPhase = 0; state.windTimer = 5;
  state.currentLookAt = null; state.crashFinalized = false; state.crashFocus = null; state.settleTimer = 0;
  camera.up.set(0, 1, 0);
  
  currentEntity.visible = false; plane.visible = true; currentEntity = plane; ball.visible = false;
  obstacles.forEach(o=> scene.remove(o.mesh));
  obstacles.length = 0;
  
  for(let i=0; i<45; i++) {
      spawnObstacle(-100 - Math.random()*1100);
  }
  nextSpawnAt = 80;

  document.getElementById('crashScreen').classList.remove('show');
  document.getElementById('windBox').classList.add('show');
  
  groundTiles.forEach((t,i)=>{
      t.position.z = -i*TILE_LEN;
      t.position.x = 0; 
      
      t.userData.ponds.forEach(p => { 
          p.x = (Math.random()-0.5)*800; 
          p.mesh.position.x = p.x; 
      });

      const grassMesh = t.children.find(c => c.isInstancedMesh);
      if(grassMesh){
          const dummy = new THREE.Object3D();
          for(let g=0; g<grassMesh.count; g++){
              let x = (Math.random() - 0.5) * 800; 
              let z = (Math.random() - 0.5) * TILE_LEN;
              let y = (Math.random() - 0.5) * 0.1;
              dummy.position.set(x, y, z);
              dummy.rotation.y = Math.random() * Math.PI * 2;
              dummy.scale.setScalar(0.7 + Math.random()*1.0);
              dummy.updateMatrix();
              grassMesh.setMatrixAt(g, dummy.matrix);
          }
          grassMesh.instanceMatrix.needsUpdate = true;
      }
  });

  updateMusicState();
}

const clock = new THREE.Clock();

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if(state.running && !state.gameOver) updatePhysics(dt);
  grassUniforms.time.value += dt;
  grassUniforms.wind.value = state.windForce;
  updateSunflowers(dt);
  updateCrashCinematic(dt);
  renderer.render(scene, camera);
}

function updatePhysics(dt){
  if(state.mode === 'fly'){
      
    const envIdx = Math.floor(state.distance / 1500) % envPalettes.length;
    const targetEnv = envPalettes[envIdx];
    scene.background.lerp(new THREE.Color(targetEnv.bg), dt * 0.5);
    scene.fog.color.lerp(new THREE.Color(targetEnv.bg), dt * 0.5);
    hemiLight.color.lerp(new THREE.Color(targetEnv.hemiSky), dt * 0.5);
    hemiLight.groundColor.lerp(new THREE.Color(targetEnv.hemiGround), dt * 0.5);

    if (state.windPhase === 0) {
        state.windTimer -= dt;
        if (state.windTimer <= 0) {
            state.targetWindForce = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.5); 
            state.windPhase = 1; state.windTimer = 6; 
            setStatus("Wind direction shifting!", 2000, true);
        }
    } else if (state.windPhase === 1) {
        state.windTimer -= dt;
        if (state.windTimer <= 0) { state.windPhase = 2; setStatus("Wind aligned with airplane direction!", 2500, false); }
    } else if (state.windPhase === 2) {
        state.targetWindForce = (state.vx / 16.0) * 0.8; 
    }
    
    state.windForce += (state.targetWindForce - state.windForce) * 0.6 * dt;
    const lateralInput = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
    const pitchInput = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
    
    if(keys['g'] && !state.barrelRolling && !state.isBoat) { 
        state.barrelRolling = true; 
        state.rollProgress = 0; 
        setStatus("Barrel Roll!", 1500, false); 
    }
    if(state.barrelRolling) {
       state.rollProgress += 0.75 * dt; 
       if(state.rollProgress >= 1.0) { 
           state.rollProgress = 0; 
           state.rollAngle = 0; 
           state.barrelRolling = false; 
       } else {
           const ease = 0.5 - 0.5 * Math.cos(Math.PI * state.rollProgress);
           state.rollAngle = ease * Math.PI * 2;
       }
    }
    
    let turbulence = Math.abs(state.windForce);
    if ((state.windForce > 0.15 && lateralInput > 0) || (state.windForce < -0.15 && lateralInput < 0)) {
        turbulence *= 0.1; state.speed += 3.0 * dt; 
    } else if (lateralInput !== 0) { turbulence *= 1.8; }

    state.pitch += (Math.random() - 0.5) * turbulence * 2.0 * dt;
    state.roll += (Math.random() - 0.5) * turbulence * 4.0 * dt;

    if(state.isBoat) {
        state.vy = 0; state.y = 0.5;
        state.speed += (15 - state.speed) * 2 * dt;
        state.vx += ((lateralInput * 25) - state.vx) * 3 * dt;
        state.pitch = 0; state.roll = -state.vx * 0.05;
        if(keys['w'] || keys['arrowup']) { 
           state.isBoat = false; state.vy = 8;
           boat.visible = false; plane.visible = true; currentEntity = plane;
        }
    } else {
        state.pitch += ((pitchInput * 0.45) - state.pitch) * 3.5 * dt;

        const aoa = state.pitch - Math.atan2(state.vy, state.speed);
        let liftCoef = aoa * 3.5 + 0.1, dragCoef = 0.02 + Math.abs(aoa) * 0.4;
        
        if(state.distance > 500) dragCoef *= (1.0 + (state.distance - 500)*0.0003);
        
        if (aoa > 0.45) {
            if(!state.stallState) setStatus("STALL WARNING! Nose down!", 1000, true);
            state.stallState = true; liftCoef *= 0.5; dragCoef *= 2.0; 
        } else { state.stallState = false; }

        state.vy += ((liftCoef * state.speed * state.speed * 0.01) - 2.5) * dt;
        state.speed += ((1.0 + (state.distance * 0.0002)) - (dragCoef * state.speed * state.speed * 0.01)) * dt;
        state.speed = THREE.MathUtils.clamp(state.speed, 8, 45);
        state.vy = THREE.MathUtils.clamp(state.vy, -15, 12);
        
        state.vx += ((lateralInput * 18) + (state.windForce * 22.0)) * dt;
        state.vx *= (1 - 2.5*dt); 
        state.vx = THREE.MathUtils.clamp(state.vx, -16, 16);

        state.x += state.vx * dt; 
        state.y += state.vy * dt;
        
        if(state.y >= ALT_MAX) {
            state.y = ALT_MAX; triggerCollision();
            setStatus("Moisture gradient breach! Max altitude 35 exceeded!", 3000, true);
        }
        state.roll += ((-state.vx * 0.12) - state.roll) * 5 * dt;
    }

    currentEntity.position.set(state.x, state.y, 0);
    currentEntity.rotation.set(state.pitch, -state.vx * 0.04, state.roll + state.rollAngle);
    
    groundTiles.forEach(t => { if (Math.abs(t.position.x - state.x) > 400) t.position.x = state.x; });

    let overPond = false;
    for(let t of groundTiles) {
        for(let p of t.userData.ponds) {
            let pWorldZ = t.position.z + p.z;
            let pWorldX = t.position.x + p.x;
            let dx = state.x - pWorldX; let dz = 0 - pWorldZ;
            if(dx*dx + dz*dz < p.r*p.r) { overPond = true; break; }
        }
        if(overPond) break;
    }
    
    if(state.y <= 1.0) {
        if(overPond) {
            if(!state.isBoat) {
                state.isBoat = true; state.y = 0.5; state.vy = 0;
                plane.visible = false; boat.visible = true; currentEntity = boat;
                setStatus("Paper Boat Active! Sail away or press UP to take off.", 2500, false);
            }
        } else {
            triggerCollision();
        }
    }
    
    document.getElementById('windSpeed').textContent = Math.round(Math.abs(state.windForce) * 35) + ' km/h';
    document.getElementById('windArrow').style.transform = `rotate(${state.windForce * (90 / 1.3)}deg)`;

    const planeQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(state.pitch, -state.vx * 0.04, state.roll, 'XYZ'));
    camera.position.lerp(new THREE.Vector3(state.x, state.y, 0).add(new THREE.Vector3(0, 1.8, 6.5).applyQuaternion(planeQuat)), 5 * dt);
    
    if (!state.currentLookAt) state.currentLookAt = new THREE.Vector3(0, state.y, -10);
    state.currentLookAt.lerp(new THREE.Vector3(state.x, state.y, 0).add(new THREE.Vector3(0, -0.5, -10).applyQuaternion(planeQuat)), 5 * dt);
    camera.up.lerp(new THREE.Vector3(0, 1, 0).applyQuaternion(planeQuat), 5 * dt);
    camera.lookAt(state.currentLookAt);

    trailIndex = (trailIndex + 1) % maxTrail;
    const ptLeft = new THREE.Vector3(-1.4, 0, 1.1).applyQuaternion(planeQuat).add(currentEntity.position);
    const ptRight = new THREE.Vector3(1.4, 0, 1.1).applyQuaternion(planeQuat).add(currentEntity.position);
    trailPos1[trailIndex*3]=ptLeft.x; trailPos1[trailIndex*3+1]=ptLeft.y; trailPos1[trailIndex*3+2]=ptLeft.z;
    trailPos2[trailIndex*3]=ptRight.x; trailPos2[trailIndex*3+1]=ptRight.y; trailPos2[trailIndex*3+2]=ptRight.z;
    trailGeo1.attributes.position.needsUpdate = true; trailGeo2.attributes.position.needsUpdate = true;

    for(const o of obstacles){
      if(o.hit) continue;
      
      const dist = Math.hypot(o.mesh.position.x - state.x, o.mesh.position.z - 0);
      if(dist < 30 && o.mesh.userData.leaves) { 
          o.mesh.userData.leaves.emissive.setHex(0x0a220a); 
      } else if (o.mesh.userData.leaves) {
          o.mesh.userData.leaves.emissive.setHex(0x000000);
      }
      
      if (Math.abs(o.mesh.position.x - state.x) < (o.width/2 + 1.2) && Math.abs(o.mesh.position.z - 0) < (o.depth/2 + 1.2)) {
         if (state.y < o.height + 1.2) { o.hit = true; triggerCollision(); }
      }
    }
    
  } else {
    state.ballVel.y -= 25 * dt; 
    ball.position.x += state.ballVel.x * dt; 
    ball.position.y += state.ballVel.y * dt;
    
    if(ball.position.y < 0.6){
      ball.position.y = 0.6; state.ballVel.y = Math.abs(state.ballVel.y) * 0.5;
      state.ballVel.x *= 0.8; state.ballVel.z *= 0.85;
      if(state.ballVel.y < 1.0) state.ballVel.y = 0;
    }
    const speedMag = Math.hypot(state.ballVel.x, state.ballVel.z);
    if(speedMag > 0.1) ball.rotateOnWorldAxis(new THREE.Vector3(-state.ballVel.z, 0, state.ballVel.x).normalize(), speedMag * dt / 0.45);

    state.speed = state.ballVel.z; state.x = ball.position.x; state.y = ball.position.y;
    camera.up.lerp(new THREE.Vector3(0, 1, 0), 4 * dt);
    camera.position.lerp(new THREE.Vector3(ball.position.x + 3, ball.position.y + 4.5, 7), 4 * dt);
    camera.lookAt(new THREE.Vector3(ball.position.x, ball.position.y, 0));

    if(speedMag < 1.0 && ball.position.y <= 0.62){
      state.settleTimer += dt;
      if(state.settleTimer > 1.0) {
          finalizeCrash();
      }
    }
  }

  state.distance += state.speed * dt;
  groundTiles.forEach(tile => {
      tile.position.z += state.speed * dt;
      if(tile.position.z > TILE_LEN * 0.6) {
          tile.position.z -= TILE_LEN * 4;
          tile.userData.ponds.forEach(p => { 
              p.x = (Math.random()-0.5)*800; 
              p.mesh.position.x = p.x; 
          });
      }
  });

  for(let i=obstacles.length-1; i>=0; i--){
    const obs = obstacles[i];
    if(obs.isVehicle) {
      obs.mesh.position.z += obs.speed * dt;
      const wheelTurn = ((obs.speed + state.speed) * dt) / obs.mesh.userData.wheelRadius;
      obs.mesh.userData.wheels.forEach(wheel => wheel.rotation.x += wheelTurn);
    }
    obs.mesh.position.z += state.speed * dt;
    if(obs.mesh.position.z > 25){ scene.remove(obs.mesh); obstacles.splice(i,1); }
  }

  let spawnFreq = Math.max(10, 45 - (state.distance * 0.005));
  if(state.distance > nextSpawnAt && state.mode === 'fly'){
    spawnObstacle();
    if(Math.random() < 0.4) spawnObstacle(); 
    nextSpawnAt += spawnFreq + Math.random()*30;
  }

  document.getElementById('distance').innerHTML = Math.floor(state.distance) + '<span>m</span>';
  document.getElementById('altMeter').textContent = state.y.toFixed(1);
}

document.getElementById('startBtn').addEventListener('click', ()=>{
  resetGame();
  document.getElementById('overlay').classList.add('hide');
  document.getElementById('windBox').classList.add('show');
  state.running = true;
  updateMusicState();
});
document.getElementById('retryBtn').addEventListener('click', ()=>{
  resetGame();
  state.running = true;
  updateMusicState();
});
document.getElementById('dashboardBtn').addEventListener('click', ()=>{
  document.getElementById('crashScreen').classList.remove('show');
  updateDashboardUI();
  document.getElementById('overlay').classList.remove('hide');
});

// --- SHORT ASSET PRE-LOADER FOR SMOOTHNESS ---
let loadTime = 0;
const loadTotal = 15.0;
const loadInterval = setInterval(() => {
    loadTime += 0.1;
    const percentage = Math.min(100, (loadTime / loadTotal) * 100);
    
    document.getElementById('loadFill').style.width = percentage + '%';
    document.querySelector('#loadingScreen [role="progressbar"]').setAttribute('aria-valuenow', Math.round(percentage));
    
    if(Math.abs(loadTime - 7.5) < 0.05) {
        renderer.compile(scene, camera);
    }
    
    if(loadTime >= loadTotal) {
        clearInterval(loadInterval);
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('overlay').classList.remove('hide');
    }
}, 100);

animate();
})();