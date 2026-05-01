document.addEventListener('DOMContentLoaded', () => {
  // --- UI Elements ---
  const input = document.getElementById('intent-input');
  const consoleText = document.getElementById('console-text');
  const costValue = document.getElementById('cost-value');
  const waveformBars = document.querySelectorAll('.wave-bar');
  const statusHud = document.getElementById('status-hud');

  // --- State ---
  let currentCost = 0;
  let targetCost = 0;
  let pendingAction = null; // 'braid' | 'strengthen' | null
  let activeMission = null;
  let laminarGrid = null;
  
  // Audio waveform sync simulation
  let waveInterval;

  // --- Three.js Setup ---
  const container = document.getElementById('canvas-container');
  const scene = new THREE.Scene();
  // Slight fog to blend with background
  scene.fog = new THREE.FogExp2(0x050505, 0.015);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 45);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  controls.enablePan = false;

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);

  const mainLight = new THREE.PointLight(0x22d3ee, 2, 100);
  mainLight.position.set(20, 20, 20);
  scene.add(mainLight);

  const secondaryLight = new THREE.PointLight(0xa855f7, 2, 100);
  secondaryLight.position.set(-20, -20, 20);
  scene.add(secondaryLight);

  // --- Geometry Definitions ---
  // Base model: Normal TorusKnot
  const baseGeo = new THREE.TorusKnotGeometry(10, 2, 128, 16, 2, 3);
  
  // Strengthened model: Thicker tube
  const strongGeo = new THREE.TorusKnotGeometry(10, 3.5, 128, 16, 2, 3);
  
  // Braided model: High frequency knot
  const braidGeo = new THREE.TorusKnotGeometry(10, 1.5, 256, 32, 5, 8);

  // Materials
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x555555,
    metalness: 0.8,
    roughness: 0.2,
  });

  const ghostMaterial = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    wireframe: true,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending
  });

  const anchoredBraidMaterial = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0x083344,
    emissiveIntensity: 0.5
  });

  const anchoredStrongMaterial = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.9,
    roughness: 0.3,
  });

  // Meshes
  const baseMesh = new THREE.Mesh(baseGeo, baseMaterial);
  scene.add(baseMesh);

  const ghostMesh = new THREE.Mesh(baseGeo, ghostMaterial);
  ghostMesh.visible = false;
  ghostMesh.scale.set(1.02, 1.02, 1.02);
  scene.add(ghostMesh);

  // --- Animation Loop ---
  const clock = new THREE.Clock();
  
  function animate() {
    requestAnimationFrame(animate);
    
    const elapsedTime = clock.getElapsedTime();
    controls.update();

    if (ghostMesh.visible) {
      const pulse = Math.sin(elapsedTime * 4) * 0.02;
      ghostMesh.scale.set(1.02 + pulse, 1.02 + pulse, 1.02 + pulse);
      ghostMesh.rotation.y = elapsedTime * 0.1; 
    }

    baseMesh.rotation.y = Math.sin(elapsedTime * 0.2) * 0.1;

    if (currentCost !== targetCost) {
      const diff = targetCost - currentCost;
      currentCost += diff * 0.1;
      if (Math.abs(diff) < 0.5) currentCost = targetCost;
      costValue.innerText = Math.round(currentCost).toLocaleString();
    }

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Logic & Feedback Loop ---

  function printConsole(key, placeholders = {}) {
    consoleText.classList.remove('type-anim');
    void consoleText.offsetWidth;
    consoleText.classList.add('type-anim');
    consoleText.innerText = window.miniappI18n.t(`app.${key}`, placeholders) || key;
  }

  function simulateVoiceInput() {
    waveformBars.forEach(bar => bar.style.animationDuration = '0.3s');
    clearTimeout(waveInterval);
    waveInterval = setTimeout(() => {
      waveformBars.forEach(bar => bar.style.animationDuration = '1s');
    }, 500);
  }

  function applyGhost(type) {
    pendingAction = type;
    ghostMesh.visible = true;
    if (type === 'braid') {
      ghostMesh.geometry = braidGeo;
      printConsole('ghost_braid');
      targetCost += 450;
    } else if (type === 'strengthen') {
      ghostMesh.geometry = strongGeo;
      printConsole('ghost_strengthen');
      targetCost += 120;
    }
  }

  function anchorGeometry() {
    if (!pendingAction) {
      printConsole('anchor_fail');
      return;
    }

    if (pendingAction === 'braid') {
      baseMesh.geometry = braidGeo;
      baseMesh.material = anchoredBraidMaterial;
      mainLight.intensity = 4;
      setTimeout(() => mainLight.intensity = 2, 1000);
    } else if (pendingAction === 'strengthen') {
      baseMesh.geometry = strongGeo;
      baseMesh.material = anchoredStrongMaterial;
    }

    ghostMesh.visible = false;
    const reward = Math.floor(Math.random() * 50) + targetCost;
    targetCost = reward;
    
    printConsole('anchor_success', { reward });
    pendingAction = null;
  }

  function loadMission(id) {
    activeMission = id;
    
    // Update HUD Resonance and Constraints
    if(statusHud) {
      statusHud.innerText = window.miniappI18n.t('app.status_mission', { id });
    }

    // Apply Laminar Constraints (Grid)
    if (!laminarGrid) {
      laminarGrid = new THREE.GridHelper(60, 30, 0x22d3ee, 0x083344);
      laminarGrid.position.y = -15;
      scene.add(laminarGrid);
    }

    // Load Legendrian Materials ("6D_Graphene", "Dirac_Fluid")
    baseMaterial.color.setHex(0x1a1a1a);
    baseMaterial.metalness = 0.9;
    baseMaterial.roughness = 0.4;
    
    anchoredBraidMaterial.color.setHex(0x0ea5e9);
    anchoredBraidMaterial.transparent = true;
    anchoredBraidMaterial.opacity = 0.9;
    anchoredBraidMaterial.emissive.setHex(0x0284c7);

    if (id === 'CAD-008') {
      printConsole('mission_cad008');
      
      // Apply Mars Cydonia Gravity
      document.body.style.backgroundColor = '#1a0c08';
      document.body.classList.remove('bg-[#050505]');
      
      scene.fog.color.setHex(0x1a0c08);
      scene.fog.density = 0.025;
      
      ambientLight.color.setHex(0xffaa88);
      mainLight.color.setHex(0xff5500); 
      secondaryLight.color.setHex(0x883311);
      
      // Adjust gravity physics (floaty control damping)
      controls.dampingFactor = 0.01;
      controls.autoRotateSpeed = 0.2;
      
      // Update constraint visual for Mars
      laminarGrid.material.color.setHex(0xff5500);
      laminarGrid.material.transparent = true;
      laminarGrid.material.opacity = 0.5;

    } else {
      printConsole('mission_loading', { id });
      setTimeout(() => printConsole('mission_materials'), 2000);
    }
  }

  // --- Event Listeners ---
  input.addEventListener('input', simulateVoiceInput);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value.trim().toLowerCase();
      input.value = '';
      
      if (!val) return;

      if (val.includes('mission') || val.match(/cad[- ]?008/)) {
        let id = 'UNKNOWN';
        if (val.includes('cad-008') || val.includes('cad 008') || val.includes('cad008')) {
          id = 'CAD-008';
        } else {
          const parts = val.split(' ');
          id = parts[parts.length - 1].toUpperCase();
        }
        loadMission(id);
      } else if (val.includes('braid')) {
        applyGhost('braid');
      } else if (val.includes('strengthen') || val.includes('stronger')) {
        applyGhost('strengthen');
      } else if (val.includes('anchor')) {
        anchorGeometry();
      } else {
        printConsole('unknown');
      }
    }
  });

  // Init
  setTimeout(() => {
    consoleText.innerText = window.miniappI18n.t('app.system_ready');
    if(statusHud) {
      statusHud.innerText = window.miniappI18n.t('app.status_default');
    }
  }, 100);
});