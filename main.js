import * as THREE from "three";
import * as OIMO from "oimo";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import gsap from "gsap";

// Shot shape types
const SHOT_SHAPES = {
  STRAIGHT: "straight",
  DRAW: "draw",
  FADE: "fade",
  SLICE: "slice",
  HOOK: "hook",
};

// Shot shape configurations
const SHOT_SHAPE_CONFIGS = {
  [SHOT_SHAPES.STRAIGHT]: {
    name: "Straight",
    emoji: "➡️",
    displayName: "STR",
    offset: { x: 0, y: 0 },
    description: "Straight flight path",
  },
  [SHOT_SHAPES.DRAW]: {
    name: "Draw",
    emoji: "⬅️",
    displayName: "DRW",
    offset: { x: -1, y: 0 }, // Will be rotated perpendicular to flight direction
    description: "Curves slightly left",
  },
  [SHOT_SHAPES.FADE]: {
    name: "Fade",
    emoji: "➡️",
    displayName: "FAD",
    offset: { x: 1, y: 0 }, // Will be rotated perpendicular to flight direction
    description: "Curves slightly right",
  },
  [SHOT_SHAPES.SLICE]: {
    name: "Slice",
    emoji: "➡️",
    displayName: "SLC",
    offset: { x: 2, y: 0 }, // Will be rotated perpendicular to flight direction
    description: "Curves sharply right",
  },
  [SHOT_SHAPES.HOOK]: {
    name: "Hook",
    emoji: "⬅️",
    displayName: "HOK",
    offset: { x: -2, y: 0 }, // Will be rotated perpendicular to flight direction
    description: "Curves sharply left",
  },
};

// Game state
let gameState = {
  grid: [],
  slopes: [],
  ballPosition: { x: 0, y: 0 },
  holePosition: { x: 0, y: 0 },
  strokes: 0,
  lastDiceRoll: 0,
  lastShotShape: SHOT_SHAPES.STRAIGHT,
  gameOver: false,
  currentTileType: "rough",
  selectedDice: 1,
  par: 4,
};

// Tile types
const TILE_TYPES = {
  ROUGH: "rough",
  FAIRWAY: "fairway",
  SAND: "sand",
  WATER: "water",
  TREE: "tree",
  TEE: "tee",
  HOLE: "hole",
  GREEN: "green",
};

// Slope directions
const SLOPE_DIRECTIONS = {
  NONE: null,
  NORTH: { dx: 0, dy: -1, arrow: "↑" },
  NORTHEAST: { dx: 1, dy: -1, arrow: "↗" },
  EAST: { dx: 1, dy: 0, arrow: "→" },
  SOUTHEAST: { dx: 1, dy: 1, arrow: "↘" },
  SOUTH: { dx: 0, dy: 1, arrow: "↓" },
  SOUTHWEST: { dx: -1, dy: 1, arrow: "↙" },
  WEST: { dx: -1, dy: 0, arrow: "←" },
  NORTHWEST: { dx: -1, dy: -1, arrow: "↖" },
};

// Shot shape dice (always the same for all players)
const SHOT_SHAPE_DICE = {
  name: "Shot Shape",
  faces: [
    SHOT_SHAPES.STRAIGHT,
    SHOT_SHAPES.STRAIGHT,
    SHOT_SHAPES.DRAW,
    SHOT_SHAPES.FADE,
    SHOT_SHAPES.SLICE,
    SHOT_SHAPES.HOOK,
  ],
};

// Dice types
const DICE_TYPES = {
  1: { name: "Driver", faces: [4, 5, 6, 7, 8, 10] },
  2: { name: "Long iron shot", faces: [3, 3, 3, 4, 4, 5] },
  3: { name: "Wedge shot", faces: [2, 2, 2, 3, 3, 3] },
  4: { name: "Chip shot", faces: [1, 1, 1, 2, 2, 2] },
  5: { name: "Putter", faces: [1, 1, 1, 1, 1, 2] },
};

// Three.js setup
let scene, camera, renderer, controls;
let gridMeshes = [];
let ballMesh, holeMesh;
let possibleMoveHighlights = [];
let treeMeshes = []; // Track 3D trees separately
let diceMesh; // 3D dice cube

// Physics setup
let world;
let composer;
let accumulator = 0;
let lastTime = 0;
let fixedTimeStep = 1 / 120; // 120 Hz
let physicsDice = []; // Array to hold physics distance dice objects
let shotShapeDice = null; // Single shot shape dice object
let diceAmount = 1; // Number of distance dice to roll

// Ball tracer system
let ballTracers = []; // Array to hold multiple tracers for each stroke
let currentTracer = null;
let tracerPoints = [];
let isBallFlying = false;

// Celebration system
let celebrationContainer = null;
let celebrationImage = null;
let celebrationAudio = null;
let celebrationButton = null;

// Sound system
let currentSound = null;

// Camera control variables
let cameraTarget = new THREE.Vector3(8, 0, 16);
let cameraPosition = new THREE.Vector3(8, 20, 20); // Higher up for more top-down view
const cameraSpeed = 0.5;
const cameraBounds = {
  minX: -5,
  maxX: 21,
  minZ: -5,
  maxZ: 37,
  minY: 12,
  maxY: 30, // Higher camera bounds
};

// Initialize Three.js scene
function initThreeJS() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2c5530);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.copy(cameraPosition);
  camera.lookAt(cameraTarget);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("gameContainer").appendChild(renderer.domElement);

  // Enhanced lighting for physics dice
  const ambientLight = new THREE.AmbientLight(0xfaf9eb, 1.2);
  scene.add(ambientLight);

  // Main directional light for shadows and depth
  const directionalLight = new THREE.DirectionalLight(0xfaf9eb, 2.5);
  directionalLight.position.set(-30, 50, -30);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.left = -20;
  directionalLight.shadow.camera.right = 20;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  directionalLight.shadow.bias = -0.0005;

  // Create light target for better shadow direction
  const lightTarget = new THREE.Object3D();
  scene.add(lightTarget);
  lightTarget.position.set(0, 0, 0);
  directionalLight.target = lightTarget;

  scene.add(directionalLight);

  // Fill light for better illumination
  const fillLight = new THREE.DirectionalLight(0xfaf9eb, 1.8);
  fillLight.position.set(20, 30, 20);
  scene.add(fillLight);

  // Handle window resize
  window.addEventListener("resize", onWindowResize);

  // Add camera drag controls
  addCameraDragControls();

  // Start render loop
  animate();
}

// Initialize physics world
function initPhysicsWorld() {
  world = new OIMO.World({
    timestep: 1 / 60,
    iterations: 8,
    broadphase: 2,
    worldscale: 1,
    random: true,
    info: false,
    gravity: [0, -9.8 * 3, 0],
  });

  // Add ground plane for dice collision
  world.add({
    type: "box",
    size: [100, 1, 100],
    pos: [0, -0.5, 0],
    rot: [0, 0, 0],
    move: false,
    density: 1,
  });
}

// Initialize post-processing effects
function initPostProcessing() {
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.2, // strength
    0.2, // radius
    0.85 // threshold
  );
  composer.addPass(bloomPass);
}

// Initialize celebration system
function initCelebrationSystem() {
  // Create celebration container
  celebrationContainer = document.createElement("div");
  celebrationContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    display: none;
    text-align: center;
    pointer-events: auto;
  `;

  // Create celebration image
  celebrationImage = document.createElement("img");
  celebrationImage.style.cssText = `
    width: 300px;
    height: 200px;
    object-fit: contain;
    opacity: 0;
    transform: scale(0) rotate(0deg);
    margin-bottom: 20px;
  `;

  // Create next hole button
  celebrationButton = document.createElement("button");
  celebrationButton.textContent = "Next Hole";
  celebrationButton.className = "juicy-btn";
  celebrationButton.style.cssText = `
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0;
    transform: scale(0.8);
  `;

  celebrationButton.onclick = () => {
    hideCelebration();
    transitionToNewHole();
  };

  celebrationContainer.appendChild(celebrationImage);
  celebrationContainer.appendChild(celebrationButton);
  document.body.appendChild(celebrationContainer);
}

// Initialize transition system
let transitionOverlay = null;

function initTransitionSystem() {
  // Create transition overlay
  transitionOverlay = document.createElement("div");
  transitionOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #000000;
    z-index: 2000;
    opacity: 0;
    pointer-events: none;
    display: none;
  `;

  document.body.appendChild(transitionOverlay);
}

// Transition to new hole with fade effect
function transitionToNewHole() {
  if (!transitionOverlay) return;

  // Show overlay and fade to black
  transitionOverlay.style.display = "block";
  gsap.to(transitionOverlay, {
    opacity: 1,
    duration: 0.8,
    ease: "power2.inOut",
    onComplete: () => {
      // Generate new hole while faded to black
      generateNewHole();

      // Small delay to ensure hole generation is complete
      setTimeout(() => {
        // Position camera to center on the hole before fading back in
        positionCameraOnHole();

        // Fade back in
        gsap.to(transitionOverlay, {
          opacity: 0,
          duration: 0.8,
          ease: "power2.inOut",
          onComplete: () => {
            transitionOverlay.style.display = "none";
            // Start camera sweep from hole to tee
            performCameraSweep();
          },
        });
      }, 500); // 500ms delay after hole generation
    },
  });
}

// Position camera to center on the hole
function positionCameraOnHole() {
  const holePos = gameState.holePosition;

  // Calculate camera position to center on hole while maintaining current camera properties
  const currentHeight = camera.position.y;
  const currentDistance = camera.position.distanceTo(cameraTarget);

  // Set target to hole position
  const holeTarget = new THREE.Vector3(holePos.x, 0, holePos.y);

  // Calculate camera position maintaining the same relative offset
  const currentOffset = new THREE.Vector3().subVectors(
    camera.position,
    cameraTarget
  );
  const holeCameraPos = new THREE.Vector3().addVectors(
    holeTarget,
    currentOffset
  );

  // Update camera position and target
  camera.position.copy(holeCameraPos);
  camera.lookAt(holeTarget);
  cameraTarget.copy(holeTarget);
  cameraPosition.copy(holeCameraPos);
}

// Perform smooth camera sweep from hole to tee position
function performCameraSweep() {
  const teePos = gameState.ballPosition;

  // Store current camera state
  const startPosition = camera.position.clone();
  const startTarget = cameraTarget.clone();

  // Calculate new target position (tee position)
  const endTarget = new THREE.Vector3(teePos.x, 0, teePos.y);

  // Calculate new camera position maintaining the same relative offset
  const offset = new THREE.Vector3().subVectors(startPosition, startTarget);
  const endPosition = new THREE.Vector3().addVectors(endTarget, offset);

  // Update the global camera position/target variables
  cameraPosition.copy(startPosition);
  cameraTarget.copy(startTarget);

  // Create smooth camera pan animation
  const tl = gsap.timeline();

  // Hold on current position for a moment (0.5 second)
  tl.to({}, { duration: 0.5 });

  // Smooth pan to tee position (2 seconds)
  tl.to(
    cameraPosition,
    {
      x: endPosition.x,
      y: endPosition.y,
      z: endPosition.z,
      duration: 2.0,
      ease: "power2.inOut",
    },
    0
  );

  tl.to(
    cameraTarget,
    {
      x: endTarget.x,
      y: endTarget.y,
      z: endTarget.z,
      duration: 2.0,
      ease: "power2.inOut",
    },
    0
  );

  // Update camera during animation
  tl.eventCallback("onUpdate", () => {
    camera.position.copy(cameraPosition);
    camera.lookAt(cameraTarget);
  });
}

// Play sound effect
function playSound(soundFile) {
  try {
    // Stop any currently playing sound
    if (currentSound) {
      currentSound.pause();
      currentSound.currentTime = 0;
    }

    // Create and play new sound
    currentSound = new Audio(soundFile);
    currentSound.play().catch((e) => {
      console.log(`Sound play failed for ${soundFile}:`, e);
    });
  } catch (e) {
    console.log(`Error playing sound ${soundFile}:`, e);
  }
}

// Hide celebration
function hideCelebration() {
  // Animate out both image and button
  gsap.to([celebrationImage, celebrationButton], {
    opacity: 0,
    scale: 0.8,
    duration: 0.5,
    ease: "power2.out",
    onComplete: () => {
      celebrationContainer.style.display = "none";
      // Stop any playing audio
      if (celebrationAudio) {
        celebrationAudio.pause();
        celebrationAudio.currentTime = 0;
      }

      // Show the main UI again
      const uiContainer = document.getElementById("ui");
      if (uiContainer) {
        uiContainer.style.display = "block";
      }
    },
  });
}

// Show celebration for score type
function showCelebration(scoreType) {
  // Hide any existing celebration first
  if (celebrationContainer && celebrationContainer.style.display !== "none") {
    hideCelebration();
  }

  // Hide the main UI
  const uiContainer = document.getElementById("ui");
  if (uiContainer) {
    uiContainer.style.display = "none";
  }

  // Set image source based on score type
  const imageMap = {
    birdie: "birdie.png",
    par: "par.png",
    bogey: "bogey.png",
  };

  const audioMap = {
    birdie: "birdie_sfx.mp3",
    par: "par_sfx.mp3",
    bogey: "bogey_sfx.mp3",
  };

  if (!imageMap[scoreType] || !audioMap[scoreType]) {
    console.warn(`Unknown score type: ${scoreType}`);
    return;
  }

  // Set image source
  celebrationImage.src = imageMap[scoreType];

  // Play audio
  if (celebrationAudio) {
    celebrationAudio.pause();
    celebrationAudio.currentTime = 0;
  }
  celebrationAudio = new Audio(audioMap[scoreType]);
  celebrationAudio.play().catch((e) => console.log("Audio play failed:", e));

  // Show container
  celebrationContainer.style.display = "block";

  // Animate in with GSAP (scale + rotate with spring for image)
  gsap.fromTo(
    celebrationImage,
    {
      scale: 0,
      rotation: -180,
      opacity: 0,
    },
    {
      scale: 1,
      rotation: 0,
      opacity: 1,
      duration: 0.8,
      ease: "back.out(1.7)", // Spring effect
    }
  );

  // Animate button in with a slight delay
  gsap.fromTo(
    celebrationButton,
    {
      scale: 0.8,
      opacity: 0,
    },
    {
      scale: 1,
      opacity: 1,
      duration: 0.6,
      ease: "back.out(1.7)",
      delay: 0.3, // Slight delay after image animation
    }
  );
}

// Update physics simulation
function updatePhysics(deltaTime) {
  accumulator += deltaTime;
  while (accumulator >= fixedTimeStep) {
    world.step(fixedTimeStep);
    accumulator -= fixedTimeStep;
  }

  // Update distance dice positions from physics
  physicsDice.forEach((dice) => {
    if (dice.body && dice.model) {
      let position = dice.body.getPosition();
      let quaternion = dice.body.getQuaternion();
      dice.model.position.set(position.x, position.y, position.z);
      dice.model.quaternion.set(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      );
    }
  });

  // Update shot shape dice position from physics
  if (shotShapeDice && shotShapeDice.body && shotShapeDice.model) {
    let position = shotShapeDice.body.getPosition();
    let quaternion = shotShapeDice.body.getQuaternion();
    shotShapeDice.model.position.set(position.x, position.y, position.z);
    shotShapeDice.model.quaternion.set(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );
  }
}

// Animation loop
function animate(time) {
  requestAnimationFrame(animate);

  if (lastTime) {
    const deltaTime = (time - lastTime) / 1000;
    updatePhysics(deltaTime);
  }

  lastTime = time;
  updateCamera();

  if (composer) {
    composer.render(scene, camera);
  } else {
    renderer.render(scene, camera);
  }
}

// Add camera drag controls for desktop and mobile
function addCameraDragControls() {
  let isDragging = false;
  let isClick = true; // Track if this interaction should be treated as a click
  let dragThreshold = 10; // Minimum pixels to move before considering it a drag
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let startMouseX = 0;
  let startMouseY = 0;
  let startTouchX = 0;
  let startTouchY = 0;

  // Check if event target is a UI element that should handle its own interactions
  function isUIElement(target) {
    // Check if the target or any of its parents is a UI element
    let element = target;
    while (element && element !== document.body) {
      if (
        element.id === "ui" ||
        element.id === "topStatus" ||
        element.classList.contains("dice-option") ||
        element.tagName === "BUTTON" ||
        element.tagName === "LABEL"
      ) {
        return true;
      }
      element = element.parentElement;
    }
    return false;
  }

  // Mouse event handlers
  function onMouseDown(event) {
    if (gameState.gameOver) return;

    // If clicked on a UI element, don't start drag mode
    if (isUIElement(event.target)) {
      return;
    }

    isDragging = false;
    isClick = true;
    startMouseX = event.clientX;
    startMouseY = event.clientY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    // Don't prevent default yet - let click handler work
  }

  function onMouseMove(event) {
    // Only process if we actually started a drag (not on UI element)
    if (startMouseX === 0 && startMouseY === 0) return;

    const deltaX = event.clientX - lastMouseX;
    const deltaY = event.clientY - lastMouseY;

    // Check if movement exceeds drag threshold
    const totalMovement =
      Math.abs(event.clientX - startMouseX) +
      Math.abs(event.clientY - startMouseY);

    if (totalMovement > dragThreshold) {
      isClick = false;
      if (!isDragging) {
        isDragging = true;
        // Prevent default to avoid text selection on drag
        event.preventDefault();
      }
    }

    if (isDragging) {
      // Move camera based on drag direction
      moveCameraByDrag(deltaX, deltaY);

      lastMouseX = event.clientX;
      lastMouseY = event.clientY;

      // Prevent default to avoid text selection
      event.preventDefault();
    }
  }

  function onMouseUp(event) {
    // If this was a short click (not a drag), don't prevent the click event
    if (!isClick) {
      event.preventDefault();
    }
    isDragging = false;

    // Reset coordinates for next interaction
    startMouseX = 0;
    startMouseY = 0;
    lastMouseX = 0;
    lastMouseY = 0;
  }

  // Touch event handlers
  function onTouchStart(event) {
    if (gameState.gameOver || event.touches.length !== 1) return;

    const touch = event.touches[0];

    // If touched on a UI element, don't start drag mode
    if (isUIElement(event.target)) {
      return;
    }

    isDragging = false;
    isClick = true;
    startTouchX = touch.clientX;
    startTouchY = touch.clientY;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;

    // Don't prevent default yet - let tap work for click handler
  }

  function onTouchMove(event) {
    // Only process if we actually started a drag (not on UI element)
    if (startTouchX === 0 && startTouchY === 0) return;

    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - lastTouchX;
    const deltaY = touch.clientY - lastTouchY;

    // Check if movement exceeds drag threshold
    const totalMovement =
      Math.abs(touch.clientX - startTouchX) +
      Math.abs(touch.clientY - startTouchY);

    if (totalMovement > dragThreshold) {
      isClick = false;
      if (!isDragging) {
        isDragging = true;
        // Prevent default to avoid scrolling on drag
        event.preventDefault();
      }
    }

    if (isDragging) {
      // Move camera based on drag direction
      moveCameraByDrag(deltaX, deltaY);

      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;

      // Prevent default to avoid scrolling
      event.preventDefault();
    }
  }

  function onTouchEnd(event) {
    // If this was a short tap (not a drag), don't prevent the click event
    if (!isClick && event.changedTouches.length > 0) {
      // This was a drag, prevent any subsequent click events
      event.preventDefault();
    }
    isDragging = false;

    // Reset coordinates for next interaction
    startTouchX = 0;
    startTouchY = 0;
    lastTouchX = 0;
    lastTouchY = 0;
  }

  // Mouse events
  renderer.domElement.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  // Touch events for mobile
  renderer.domElement.addEventListener("touchstart", onTouchStart);
  renderer.domElement.addEventListener("touchmove", onTouchMove);
  renderer.domElement.addEventListener("touchend", onTouchEnd);

  // Change cursor to indicate draggable
  renderer.domElement.style.cursor = "grab";

  // Update cursor during drag
  renderer.domElement.addEventListener("mousedown", () => {
    renderer.domElement.style.cursor = "grabbing";
  });

  window.addEventListener("mouseup", () => {
    renderer.domElement.style.cursor = "grab";
  });
}

// Move camera based on drag input (works for both mouse and touch)
function moveCameraByDrag(deltaX, deltaY) {
  // Convert drag deltas to camera movement
  // Scale the movement to feel natural and responsive
  const dragSensitivity = 0.04; // Increased from 0.01 for faster, more responsive camera movement
  const moveX = -deltaX * dragSensitivity;
  const moveZ = -deltaY * dragSensitivity; // Flip Z direction so dragging up moves camera north

  // Update camera target (what we're looking at)
  cameraTarget.x += moveX;
  cameraTarget.z += moveZ;

  // Update camera position (maintain relative position to target)
  cameraPosition.x += moveX;
  cameraPosition.z += moveZ;

  // Apply bounds
  cameraTarget.x = Math.max(
    cameraBounds.minX,
    Math.min(cameraBounds.maxX, cameraTarget.x)
  );
  cameraTarget.z = Math.max(
    cameraBounds.minZ,
    Math.min(cameraBounds.maxZ, cameraTarget.z)
  );
  cameraPosition.x = Math.max(
    cameraBounds.minX,
    Math.min(cameraBounds.maxX, cameraPosition.x)
  );
  cameraPosition.z = Math.max(
    cameraBounds.minZ,
    Math.min(cameraBounds.maxZ, cameraPosition.z)
  );

  // Update camera
  camera.position.copy(cameraPosition);
  camera.lookAt(cameraTarget);
}

// Update camera position (now just handles any camera updates if needed)
function updateCamera() {
  // Camera updates are now handled directly in moveCameraByDrag
  // This function is kept for any future camera smoothing or effects
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Create materials for different tile types
function createTileMaterial(tileType) {
  switch (tileType) {
    case TILE_TYPES.ROUGH:
      return new THREE.MeshLambertMaterial({ color: 0x0e875b });
    case TILE_TYPES.FAIRWAY:
      return new THREE.MeshLambertMaterial({ color: 0x02b543 });
    case TILE_TYPES.SAND:
      return new THREE.MeshLambertMaterial({ color: 0xffc9a5 });
    case TILE_TYPES.WATER:
      return new THREE.MeshLambertMaterial({ color: 0x29adff });
    case TILE_TYPES.TREE:
      return new THREE.MeshLambertMaterial({ color: 0x0e875b });
    case TILE_TYPES.TEE:
      return new THREE.MeshLambertMaterial({ color: 0xff6b6b });
    case TILE_TYPES.HOLE:
      return new THREE.MeshLambertMaterial({ color: 0xffd700 });
    case TILE_TYPES.GREEN:
      return new THREE.MeshLambertMaterial({ color: 0x90ee90 }); // Light green
    default:
      return new THREE.MeshLambertMaterial({ color: 0x4a5d23 });
  }
}

// Create 3D grid
function createGrid() {
  // Clear existing grid and trees
  gridMeshes.forEach((mesh) => scene.remove(mesh));
  treeMeshes.forEach((tree) => scene.remove(tree));
  gridMeshes = [];
  treeMeshes = [];

  const tileGeometry = new THREE.BoxGeometry(0.95, 0.1, 0.95);

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 16; x++) {
      const tileType = gameState.grid[y][x];
      const material = createTileMaterial(tileType);
      const mesh = new THREE.Mesh(tileGeometry, material);

      mesh.position.set(x, 0, y);
      mesh.receiveShadow = true;
      mesh.userData = { x, y, tileType };

      // Add special elements based on tile type
      if (tileType === TILE_TYPES.TREE) {
        // Create a 3D tree at the correct position
        const treeGroup = createTree(x, y);
        treeMeshes.push(treeGroup);
        scene.add(treeGroup);
      } else if (tileType === TILE_TYPES.WATER) {
        // Add water effect
        const waterGeometry = new THREE.BoxGeometry(0.99, 0.05, 0.99);
        const waterMaterial = new THREE.MeshLambertMaterial({
          color: 0x29adff,
          transparent: true,
          opacity: 0.8,
        });
        const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
        waterMesh.position.y = 0.05;
        mesh.add(waterMesh);
      } else if (tileType === TILE_TYPES.SAND) {
        // Add sand texture effect
        const sandGeometry = new THREE.BoxGeometry(0.99, 0.05, 0.99);
        const sandMaterial = new THREE.MeshLambertMaterial({ color: 0xf4e4bc });
        const sandMesh = new THREE.Mesh(sandGeometry, sandMaterial);
        sandMesh.position.y = 0.05;
        mesh.add(sandMesh);
      }

      // Add slope indicator if present
      //   const slope = gameState.slopes[y][x];
      //   if (slope && slope !== SLOPE_DIRECTIONS.NONE) {
      //     const slopeGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
      //     const slopeMaterial = new THREE.MeshLambertMaterial({
      //       color: 0xffffff,
      //     });
      //     const slopeMesh = new THREE.Mesh(slopeGeometry, slopeMaterial);

      //     // Rotate slope indicator based on direction
      //     const angle = Math.atan2(slope.dy, slope.dx);
      //     slopeMesh.rotation.y = angle;
      //     slopeMesh.position.set(x, 0.2, y);

      //     mesh.add(slopeMesh);
      //   }

      gridMeshes.push(mesh);
      scene.add(mesh);
    }
  }
}

// Create a 3D tree at the specified position
function createTree(x, y) {
  const treeGroup = new THREE.Group();

  // Tree trunk - smaller for pine tree
  const trunkGeometry = new THREE.CylinderGeometry(0.08, 0.12, 0.8, 8);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 0.4;
  trunk.castShadow = true;
  treeGroup.add(trunk);

  // Pine tree layers - 3 stacked cones of decreasing size (smaller)
  const pineMaterial = new THREE.MeshLambertMaterial({ color: 0x0d5a0d });

  // Bottom layer (largest)
  const bottomConeGeometry = new THREE.ConeGeometry(0.5, 0.7, 8);
  const bottomCone = new THREE.Mesh(bottomConeGeometry, pineMaterial);
  bottomCone.position.y = 1.0;
  bottomCone.castShadow = true;
  treeGroup.add(bottomCone);

  // Middle layer
  const middleConeGeometry = new THREE.ConeGeometry(0.35, 0.5, 8);
  const middleCone = new THREE.Mesh(middleConeGeometry, pineMaterial);
  middleCone.position.y = 1.4;
  middleCone.castShadow = true;
  treeGroup.add(middleCone);

  // Top layer (smallest)
  const topConeGeometry = new THREE.ConeGeometry(0.25, 0.4, 8);
  const topCone = new THREE.Mesh(topConeGeometry, pineMaterial);
  topCone.position.y = 1.7;
  topCone.castShadow = true;
  treeGroup.add(topCone);

  // Position the tree at the correct location
  treeGroup.position.set(x, 0, y);

  return treeGroup;
}

// Create custom dice mesh with text numbers on each face
function createCustomDiceMesh(diceValues = [1, 2, 3, 4, 5, 6]) {
  const diceGroup = new THREE.Group();

  // Create the main cube geometry
  const geometry = new THREE.BoxGeometry(2, 2, 2);

  // Create materials for each face with numbers
  const materials = [];

  // Face order in Three.js BoxGeometry:
  // 0: right (+X), 1: left (-X), 2: top (+Y), 3: bottom (-Y), 4: front (+Z), 5: back (-Z)

  // Map geometry faces to our desired numbers with correction for the dice orientation
  const faceMapping = [3, 4, 1, 6, 2, 5]; // Maps geometry face index to dice face number

  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");

    // Clear with transparent background
    context.clearRect(0, 0, 256, 256);

    // Set background color (dice face color)
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 256, 256);

    // Add border
    context.strokeStyle = "#f80800";
    context.lineWidth = 60;
    context.strokeRect(2, 2, 252, 252);

    // Draw the number
    const number = diceValues[faceMapping[i] - 1]; // Get the actual number for this face
    context.fillStyle = "#000000";
    context.font = "bold 120px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(number.toString(), 128, 128);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;

    // Create material with the texture
    const material = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: false,
    });

    materials.push(material);
  }

  // Create the mesh with the materials
  const mesh = new THREE.Mesh(geometry, materials);
  diceGroup.add(mesh);

  return diceGroup;
}

// Create custom shot shape dice mesh with text on each face
function createShotShapeDiceMesh() {
  const diceGroup = new THREE.Group();

  // Create the main cube geometry
  const geometry = new THREE.BoxGeometry(2, 2, 2);

  // Create materials for each face with shot shape text
  const materials = [];

  // Face order in Three.js BoxGeometry:
  // 0: right (+X), 1: left (-X), 2: top (+Y), 3: bottom (-Y), 4: front (+Z), 5: back (-Z)

  // Map geometry faces to our desired shot shapes
  const faceMapping = [
    SHOT_SHAPES.SLICE,
    SHOT_SHAPES.HOOK,
    SHOT_SHAPES.STRAIGHT,
    SHOT_SHAPES.STRAIGHT,
    SHOT_SHAPES.FADE,
    SHOT_SHAPES.DRAW,
  ];

  // Shot shape display names for the dice faces
  const shotShapeNames = {};
  Object.keys(SHOT_SHAPE_CONFIGS).forEach((shape) => {
    shotShapeNames[shape] = SHOT_SHAPE_CONFIGS[shape].displayName;
  });

  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");

    // Clear with transparent background
    context.clearRect(0, 0, 256, 256);

    // Set background color (shot shape dice - different color to distinguish)
    context.fillStyle = "#1e40af"; // Light blue background
    context.fillRect(0, 0, 256, 256);

    // Add border
    context.strokeStyle = "#2563eb"; // Blue border
    context.lineWidth = 4;
    context.strokeRect(2, 2, 252, 252);

    // Draw the shot shape text
    const shotShape = faceMapping[i];
    const displayName =
      shotShapeNames[shotShape] || shotShape.toUpperCase().substring(0, 3);

    context.fillStyle = "#ffffff"; // Dark blue text
    context.font = "bold 80px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(displayName, 128, 128);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;

    // Create material with the texture
    const material = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: false,
    });

    materials.push(material);
  }

  // Create the mesh with the materials
  const mesh = new THREE.Mesh(geometry, materials);
  diceGroup.add(mesh);

  return diceGroup;
}

// Create physics-based shot shape dice
function createPhysicsShotShapeDice(x, y, z) {
  return new Promise((resolve) => {
    // Create custom shot shape dice mesh
    const model = createShotShapeDiceMesh();
    scene.add(model);
    model.position.set(x, y, z);

    // Enable shadows
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Create physics body
    const body = world.add({
      type: "box",
      size: [2, 2, 2],
      pos: [x, y, z],
      rot: [
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      ],
      move: true,
      density: 2,
      friction: 0.5,
      restitution: 0.75,
      belongsTo: 1,
      collidesWith: 0xffffffff,
    });

    resolve({ model, body });
  });
}

// Determine which shot shape is showing up based on dice rotation
function getShotShapeValue(shotShapeModel) {
  // Get the dice's current rotation matrix
  const rotationMatrix = new THREE.Matrix4();
  shotShapeModel.updateMatrixWorld(true);
  rotationMatrix.extractRotation(shotShapeModel.matrixWorld);

  // World up direction
  const worldUp = new THREE.Vector3(0, 1, 0);

  // Face normals for our shot shape dice mesh
  // These match the faceMapping in createShotShapeDiceMesh
  const faceNormals = [
    { face: SHOT_SHAPES.SLICE, normal: new THREE.Vector3(1, 0, 0) }, // right face = SLICE
    { face: SHOT_SHAPES.HOOK, normal: new THREE.Vector3(-1, 0, 0) }, // left face = HOOK
    { face: SHOT_SHAPES.STRAIGHT, normal: new THREE.Vector3(0, 1, 0) }, // top face = STRAIGHT
    { face: SHOT_SHAPES.STRAIGHT, normal: new THREE.Vector3(0, -1, 0) }, // bottom face = STRAIGHT
    { face: SHOT_SHAPES.FADE, normal: new THREE.Vector3(0, 0, 1) }, // front face = FADE
    { face: SHOT_SHAPES.DRAW, normal: new THREE.Vector3(0, 0, -1) }, // back face = DRAW
  ];

  let bestFace = SHOT_SHAPES.STRAIGHT;
  let bestDot = -1;

  // Find which face normal points most upward
  for (const faceData of faceNormals) {
    const worldNormal = faceData.normal.clone();
    worldNormal.applyMatrix4(rotationMatrix);
    worldNormal.normalize();

    const dot = worldNormal.dot(worldUp);

    if (dot > bestDot) {
      bestDot = dot;
      bestFace = faceData.face;
    }
  }

  return bestFace;
}

// Create physics-based dice using custom mesh
function createPhysicsDice(x, y, z) {
  return new Promise((resolve) => {
    // Get current dice type values
    const selectedDiceType = DICE_TYPES[gameState.selectedDice];
    const diceValues = selectedDiceType.faces;

    // Create custom dice mesh
    const model = createCustomDiceMesh(diceValues);
    scene.add(model);
    model.position.set(x, y, z);

    // Enable shadows
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Create physics body
    const body = world.add({
      type: "box",
      size: [2, 2, 2],
      pos: [x, y, z],
      rot: [
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      ],
      move: true,
      density: 2,
      friction: 0.5,
      restitution: 0.75,
      belongsTo: 1,
      collidesWith: 0xffffffff,
    });

    resolve({ model, body });
  });
}

// Custom dice creation is now handled by createCustomDiceMesh

// Remove all physics dice
function removePhysicsDice() {
  physicsDice.forEach((dice) => {
    if (dice.model) {
      scene.remove(dice.model);
    }
    // Physics body will be cleared when world is cleared
  });
  physicsDice = [];
}

// Remove shot shape dice
function removeShotShapeDice() {
  if (shotShapeDice && shotShapeDice.model) {
    scene.remove(shotShapeDice.model);
    shotShapeDice = null;
  }
}

// Animate dice with springback effect and fade out
function animateDiceExit() {
  const allDice = [...physicsDice];
  if (shotShapeDice) {
    allDice.push(shotShapeDice);
  }

  if (allDice.length === 0) return;

  // Create a timeline for the animation
  const tl = gsap.timeline();

  // First phase: Spring expansion (0.3s)
  allDice.forEach((dice, index) => {
    if (dice.model) {
      // Stagger the animation slightly for each die
      const delay = index * 0.2;

      tl.to(
        dice.model.scale,
        {
          x: 1.2,
          y: 1.2,
          z: 1.2,
          duration: 0.15,
          ease: "back.out(2)",
          delay: delay,
        },
        0
      );

      // Also animate material opacity if available
      dice.model.traverse((child) => {
        if (child.material && child.material.opacity !== undefined) {
          tl.to(
            child.material,
            {
              opacity: 0.8,
              duration: 0.3,
              ease: "power2.out",
              delay: delay,
            },
            0
          );
        }
      });
    }
  });

  // Second phase: Shrink and fade out (0.5s)
  allDice.forEach((dice, index) => {
    if (dice.model) {
      const delay = 0.15 + index * 0.05; // Start after expansion

      tl.to(
        dice.model.scale,
        {
          x: 0.1,
          y: 0.1,
          z: 0.1,
          duration: 0.5,
          ease: "power2.in",
          delay: delay,
        },
        0.3
      );

      // Fade out completely
      dice.model.traverse((child) => {
        if (child.material && child.material.opacity !== undefined) {
          tl.to(
            child.material,
            {
              opacity: 0,
              duration: 0.5,
              ease: "linear",
              delay: delay,
            },
            0.3
          );
        }
      });
    }
  });

  // Third phase: Remove from scene after animation completes
  tl.call(
    () => {
      removePhysicsDice();
      removeShotShapeDice();
    },
    [],
    0.8
  ); // 0.8s total duration
}

// Roll physics dice (both distance and shot shape)
function rollPhysicsDice() {
  removePhysicsDice();
  removeShotShapeDice();

  // Use current camera target position so dice drop where camera is looking
  const centerX = cameraTarget.x;
  const centerZ = cameraTarget.z;

  const dicePromises = [];
  for (let i = 0; i < diceAmount; i++) {
    // Position distance dice in a small circle around the camera's current target
    const angle = (i / diceAmount) * Math.PI * 2;
    const radius = 1.5; // Small radius around center
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    dicePromises.push(createPhysicsDice(x, 15, z));
  }

  // Create shot shape dice (positioned at camera's current target)
  const shotShapePromise = createPhysicsShotShapeDice(centerX, 15, centerZ);

  Promise.all([...dicePromises, shotShapePromise]).then((results) => {
    physicsDice = results.slice(0, -1); // All but the last are distance dice
    shotShapeDice = results[results.length - 1]; // Last one is shot shape dice
  });
}

// Read the final dice values from physics simulation
function readDiceValues() {
  const results = [];

  physicsDice.forEach((dice, index) => {
    if (dice.model) {
      const value = getDiceValue(dice.model);
      results.push(value);
    }
  });

  return results;
}

// Determine which face is showing up based on dice rotation
function getDiceValue(diceModel) {
  // Get the dice's current rotation matrix
  const rotationMatrix = new THREE.Matrix4();
  diceModel.updateMatrixWorld(true);
  rotationMatrix.extractRotation(diceModel.matrixWorld);

  // World up direction
  const worldUp = new THREE.Vector3(0, 1, 0);

  // Face normals for our custom dice mesh
  // These match the faceMapping in createCustomDiceMesh: [3, 4, 1, 6, 2, 5]
  // Standard die orientation: 1 opposite 6, 2 opposite 5, 3 opposite 4
  const faceNormals = [
    { face: 3, normal: new THREE.Vector3(1, 0, 0) }, // right face = 3
    { face: 4, normal: new THREE.Vector3(-1, 0, 0) }, // left face = 4
    { face: 1, normal: new THREE.Vector3(0, 1, 0) }, // top face = 1
    { face: 6, normal: new THREE.Vector3(0, -1, 0) }, // bottom face = 6
    { face: 2, normal: new THREE.Vector3(0, 0, 1) }, // front face = 2
    { face: 5, normal: new THREE.Vector3(0, 0, -1) }, // back face = 5
  ];

  let bestFace = 1;
  let bestDot = -1;

  // Find which face normal points most upward
  for (const faceData of faceNormals) {
    const worldNormal = faceData.normal.clone();
    worldNormal.applyMatrix4(rotationMatrix);
    worldNormal.normalize();

    const dot = worldNormal.dot(worldUp);

    if (dot > bestDot) {
      bestDot = dot;
      bestFace = faceData.face;
    }
  }

  // Get current dice type values
  const selectedDiceType = DICE_TYPES[gameState.selectedDice];
  const diceValues = selectedDiceType.faces;

  // Map face number to the actual value on that face
  // diceValues array is ordered by face number: diceValues[0] = face 1, diceValues[1] = face 2, etc.
  const valueIndex = bestFace - 1; // Face 1 = index 0, Face 2 = index 1, etc.
  const actualValue = diceValues[valueIndex];

  return actualValue;
}

// Create ball
function createBall() {
  if (ballMesh) {
    scene.remove(ballMesh);
  }

  const ballGeometry = new THREE.SphereGeometry(0.2, 16, 16);
  const ballMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);

  ballMesh.position.set(
    gameState.ballPosition.x,
    0.3,
    gameState.ballPosition.y
  );
  ballMesh.castShadow = true;

  scene.add(ballMesh);
}

// Initialize ball tracer system
function initBallTracer() {
  // Initialize tracer arrays
  ballTracers = [];
  currentTracer = null;
  tracerPoints = [];
  isBallFlying = false;
}

// Start ball tracer when ball begins flight
function startBallTracer(startPosition) {
  // Create a new tracer for this stroke
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    linewidth: 16,
  });

  const newTracer = new THREE.Line(geometry, material);
  scene.add(newTracer);

  // Add to our tracers array
  ballTracers.push(newTracer);
  currentTracer = newTracer;

  // Initialize tracer points for this stroke
  tracerPoints = [startPosition.clone()];
  isBallFlying = true;
  newTracer.visible = true;
  updateTracerGeometry();
}

// Update ball tracer as ball flies
function updateBallTracer(currentPosition) {
  if (!isBallFlying) return;

  // Add current position to tracer points
  tracerPoints.push(currentPosition.clone());

  // Limit tracer length to prevent performance issues
  const maxPoints = 50;
  if (tracerPoints.length > maxPoints) {
    tracerPoints.shift(); // Remove oldest point
  }

  updateTracerGeometry();
}

// Update the tracer line geometry
function updateTracerGeometry() {
  if (!currentTracer || tracerPoints.length < 2) return;

  const positions = [];
  tracerPoints.forEach((point) => {
    positions.push(point.x, point.y + 0.1, point.z); // Slightly above ground
  });

  currentTracer.geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  currentTracer.geometry.attributes.position.needsUpdate = true;
}

// Stop ball tracer when ball lands (but keep it visible)
function stopBallTracer() {
  isBallFlying = false;
  currentTracer = null;
  tracerPoints = [];
}

// Clear all ball tracers completely
function clearAllBallTracers() {
  ballTracers.forEach((tracer) => {
    if (tracer) {
      scene.remove(tracer);
    }
  });
  ballTracers = [];
  currentTracer = null;
  tracerPoints = [];
  isBallFlying = false;
}

// Create hole flag
function createHole() {
  if (holeMesh) {
    scene.remove(holeMesh);
  }

  const flagGroup = new THREE.Group();

  // Flag pole
  const poleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 2, 8);
  const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.y = 1;
  flagGroup.add(pole);

  // Flag
  const flagGeometry = new THREE.PlaneGeometry(0.5, 0.3);
  const flagMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
  const flag = new THREE.Mesh(flagGeometry, flagMaterial);
  flag.position.set(0.25, 1.5, 0);
  flagGroup.add(flag);

  holeMesh = flagGroup;
  holeMesh.position.set(gameState.holePosition.x, 0, gameState.holePosition.y);

  scene.add(holeMesh);
}

// Highlight possible moves
function highlightPossibleMoves(moves) {
  // Clear existing highlights
  clearHighlights();

  const highlightGeometry = new THREE.BoxGeometry(0.99, 0.05, 0.99);
  const highlightMaterial = new THREE.MeshLambertMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.7,
  });

  moves.forEach((move) => {
    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    highlight.position.set(move.x, 0.05, move.y);
    highlight.userData = { x: move.x, y: move.y };

    possibleMoveHighlights.push(highlight);
    scene.add(highlight);
  });
}

// Clear move highlights
function clearHighlights() {
  possibleMoveHighlights.forEach((highlight) => scene.remove(highlight));
  possibleMoveHighlights = [];
}

// Add click handler for move selection
function addClickHandler() {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function handleInteraction(clientX, clientY) {
    if (gameState.gameOver) return;

    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Check for highlight clicks
    const highlightIntersects = raycaster.intersectObjects(
      possibleMoveHighlights
    );
    if (highlightIntersects.length > 0) {
      const highlight = highlightIntersects[0].object;
      moveBall(highlight.userData.x, highlight.userData.y);
      return true; // Interaction was handled
    }
    return false; // No highlight was clicked
  }

  function onMouseClick(event) {
    handleInteraction(event.clientX, event.clientY);
  }

  function onTouchTap(event) {
    if (event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      if (handleInteraction(touch.clientX, touch.clientY)) {
        event.preventDefault(); // Prevent click event from also firing
      }
    }
  }

  renderer.domElement.addEventListener("click", onMouseClick);
  renderer.domElement.addEventListener("touchend", onTouchTap);
}

// Game logic functions (adapted from 2D version)
function calculatePar(teePos, holePos) {
  const distance =
    Math.abs(teePos.x - holePos.x) + Math.abs(teePos.y - holePos.y);
  if (distance <= 8) return 3;
  else if (distance <= 15) return 4;
  else return 5;
}

function selectDice(diceType) {
  if (gameState.gameOver) return;

  gameState.selectedDice = diceType;

  // Regenerate the dice selection UI to update the selected state
  generateDiceSelectionUI();

  // Hide dice selection after selecting to save screen space
  setTimeout(() => {
    const diceSelection = document.getElementById("diceSelection");
    const toggleButton = document.getElementById("toggleDice");

    if (
      diceSelection &&
      toggleButton &&
      !diceSelection.classList.contains("hidden")
    ) {
      diceSelection.classList.add("hidden");
      toggleButton.textContent = "Clubs";
      toggleButton.classList.add("cta-btn");
    }
  }, 500); // Small delay to let user see the selection
}

function rollDice() {
  if (gameState.gameOver) return;

  // Disable button during animation
  document.getElementById("rollDice").disabled = true;

  // Start UI spinning animation
  startDiceAnimation();

  // Roll physics dice
  rollPhysicsDice();

  // After animation, read the actual dice values and show movement options
  setTimeout(() => {
    // Read the actual distance dice values from physics simulation
    const diceValues = readDiceValues();

    if (diceValues.length > 0) {
      // Use the highest dice value for distance (like in Yahtzee or other dice games)
      const maxValue = Math.max(...diceValues);
      gameState.lastDiceRoll = maxValue;
      gameState.strokes++;

      // Read the shot shape from the physics dice
      if (shotShapeDice && shotShapeDice.model) {
        gameState.lastShotShape = getShotShapeValue(shotShapeDice.model);
      } else {
        gameState.lastShotShape = SHOT_SHAPES.STRAIGHT; // Fallback
      }

      // Apply tile effects
      let distance = gameState.lastDiceRoll;
      const currentTile =
        gameState.grid[gameState.ballPosition.y][gameState.ballPosition.x];

      if (
        currentTile === TILE_TYPES.FAIRWAY ||
        currentTile === TILE_TYPES.TEE
      ) {
        distance += 1; // Fairway bonus (tee also gets fairway bonus)
      } else if (currentTile === TILE_TYPES.SAND) {
        distance -= 1; // Sand penalty
      }

      distance = Math.max(1, distance); // Minimum distance of 1

      // Show final dice result with distance, shot shape, and all dice values
      showDiceResult(
        gameState.lastDiceRoll,
        diceValues,
        gameState.lastShotShape
      );

      updateUI();
      showMovementOptions(distance);

      // Start dice exit animation after showing results
      setTimeout(() => {
        animateDiceExit();
      }, 1500); // Wait 1.5 seconds after showing results before animating out
    }

    // Re-enable button
    document.getElementById("rollDice").disabled = false;
  }, 2500); // 2.5 second animation for physics dice to settle
}

// Start dice spinning animation (removed UI updates)
function startDiceAnimation() {
  // Keep timing for physics simulation but remove UI updates
  setTimeout(() => {
    // Animation timing preserved for physics dice settling
  }, 1500);
}

// Physics dice don't need manual animation - physics handles it

// Show final dice result - physics dice will naturally settle
function showDiceResult(distance, diceValues = [], shotShape = "straight") {
  // Get shot shape display name with emoji from configuration
  const config = SHOT_SHAPE_CONFIGS[shotShape];
  const shotShapeDisplay = config
    ? `${config.emoji} ${config.name}`
    : shotShape;

  if (diceValues.length > 0) {
    // Show all dice values
    const diceDisplay = diceValues.join(", ");
    console.log(
      `Dice values: [${diceDisplay}], Distance: ${distance}, Shape: ${shotShape}`
    );
  } else {
    // Fallback for single die
    console.log(`Dice result: ${distance}, Shape: ${shotShape}`);
  }
}

function putt() {
  if (gameState.gameOver) return;

  gameState.strokes++;
  gameState.lastDiceRoll = 1;
  gameState.lastShotShape = SHOT_SHAPES.STRAIGHT; // Putts are always straight

  updateUI();
  showMovementOptions(1);
}

function showMovementOptions(distance) {
  const ballPos = gameState.ballPosition;
  const currentTile = gameState.grid[ballPos.y][ballPos.x];
  const canGoOverTrees =
    currentTile === TILE_TYPES.FAIRWAY || currentTile === TILE_TYPES.TEE;

  // Clear previous highlights
  clearHighlights();

  // Calculate possible moves
  const possibleMoves = [];

  // Check all 8 directions
  const directions = [
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
  ];

  directions.forEach((dir) => {
    let newX = ballPos.x + dir.dx * distance;
    let newY = ballPos.y + dir.dy * distance;

    // Apply shot shape offset using the new configuration system
    const offset = calculateShotShapeOffset(dir, gameState.lastShotShape);
    newX += offset.x;
    newY += offset.y;

    if (newX >= 0 && newX < 16 && newY >= 0 && newY < 32) {
      const targetTile = gameState.grid[newY][newX];

      // Can't land on trees or water
      if (targetTile === TILE_TYPES.TREE || targetTile === TILE_TYPES.WATER) {
        return;
      }

      // Check if path is clear
      if (isPathClear(ballPos.x, ballPos.y, newX, newY, canGoOverTrees)) {
        possibleMoves.push({ x: newX, y: newY });
      }
    }
  });

  // Highlight possible moves
  highlightPossibleMoves(possibleMoves);

  if (possibleMoves.length === 0) {
    // No valid moves - removed UI feedback
  }
}

function isPathClear(fromX, fromY, toX, toY, canGoOverTrees) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));

  for (let i = 1; i < steps; i++) {
    const x = fromX + Math.round((dx * i) / steps);
    const y = fromY + Math.round((dy * i) / steps);

    const tile = gameState.grid[y][x];
    // Can go over water, but can't go through trees unless on fairway
    if (tile === TILE_TYPES.TREE && !canGoOverTrees) {
      return false; // Can't go through trees unless on fairway
    }
  }

  return true;
}

function moveBall(newX, newY) {
  if (gameState.gameOver) return;

  // Play golf hit sound
  playSound("golf_hit.mp3");

  // Animate ball movement
  animateBallFlight(newX, newY);
}

function animateBallFlight(newX, newY) {
  const startPos = ballMesh.position.clone();
  const endPos = new THREE.Vector3(newX, 0.3, newY);

  const duration = 500; // ms
  const startTime = Date.now();

  // Start the ball tracer
  startBallTracer(startPos);

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Apply quadratic ease-out to horizontal movement
    // This makes the ball start fast and gradually slow down
    const easedProgress = 1 - Math.pow(1 - progress, 2);

    // Parabolic arc
    const t = progress;
    const height = 2 * Math.sin(t * Math.PI);

    ballMesh.position.lerpVectors(startPos, endPos, easedProgress);
    ballMesh.position.y = 0.3 + height;

    // Update tracer with current ball position
    updateBallTracer(ballMesh.position);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Stop the tracer when ball lands
      stopBallTracer();
      // Complete the move
      completeMove(newX, newY);
    }
  }

  animate();
}

function completeMove(newX, newY) {
  const oldTile =
    gameState.grid[gameState.ballPosition.y][gameState.ballPosition.x];
  if (oldTile === TILE_TYPES.TEE) {
    gameState.grid[gameState.ballPosition.y][gameState.ballPosition.x] =
      TILE_TYPES.FAIRWAY;
  }

  gameState.ballPosition = { x: newX, y: newY };
  gameState.currentTileType = gameState.grid[newY][newX];

  // Check if ball is in hole
  if (newX === gameState.holePosition.x && newY === gameState.holePosition.y) {
    gameState.gameOver = true;

    // Play hole-out sound
    playSound("hole_out.mp3");
    const score = gameState.strokes - gameState.par;
    let message = `Hole in ${gameState.strokes} strokes! `;

    // Determine celebration type
    let celebrationType = null;
    if (score === -1 || score === -2) {
      // Birdie or Eagle
      celebrationType = "birdie";
      message += score === -1 ? "Birdie! Excellent!" : "Eagle! Outstanding!";
    } else if (score === 0) {
      celebrationType = "par";
      message += "Par! Great job!";
    } else if (score === 1) {
      celebrationType = "bogey";
      message += "Bogey. Not bad!";
    } else if (score === 2) {
      message += "Double Bogey. Keep trying!";
    } else if (score > 2) {
      message += `${score} over par. Practice makes perfect!`;
    }

    // Show celebration if applicable
    if (celebrationType) {
      showCelebration(celebrationType);
    }

    // Removed game status UI update
    clearHighlights();
    createGrid();
    createBall();
    updateUI();
    return;
  }

  // Check for slope and roll if needed
  const slope = gameState.slopes[newY][newX];
  if (slope && slope !== SLOPE_DIRECTIONS.NONE) {
    setTimeout(() => {
      rollBall(slope);
    }, 500);
  } else {
    clearHighlights();
    createGrid();
    createBall();
    updateUI();
  }
}

function rollBall(slope) {
  const currentPos = gameState.ballPosition;
  const newX = currentPos.x + slope.dx;
  const newY = currentPos.y + slope.dy;

  // Play golf hit sound when ball rolls on slope
  playSound("golf_hit.mp3");

  if (newX >= 0 && newX < 16 && newY >= 0 && newY < 32) {
    const targetTile = gameState.grid[newY][newX];

    if (targetTile !== TILE_TYPES.WATER && targetTile !== TILE_TYPES.TREE) {
      animateBallRoll(newX, newY, slope);
    } else {
      clearHighlights();
      createGrid();
      createBall();
      updateUI();
    }
  } else {
    clearHighlights();
    createGrid();
    createBall();
    updateUI();
  }
}

function animateBallRoll(newX, newY, slope) {
  const startPos = ballMesh.position.clone();
  const endPos = new THREE.Vector3(newX, 0.3, newY);

  const duration = 300; // ms
  const startTime = Date.now();

  // Start the ball tracer for slope rolls
  startBallTracer(startPos);

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    ballMesh.position.lerpVectors(startPos, endPos, progress);

    // Update tracer with current ball position
    updateBallTracer(ballMesh.position);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Stop the tracer when ball finishes rolling
      stopBallTracer();
      // Complete the roll
      completeRoll(newX, newY);
    }
  }

  animate();
}

function completeRoll(newX, newY) {
  gameState.ballPosition = { x: newX, y: newY };
  gameState.currentTileType = gameState.grid[newY][newX];

  // Check if ball rolled into hole
  if (newX === gameState.holePosition.x && newY === gameState.holePosition.y) {
    gameState.gameOver = true;

    // Play hole-out sound
    playSound("hole_out.mp3");
    const score = gameState.strokes - gameState.par;
    let message = `Hole in ${gameState.strokes} strokes! `;

    // Determine celebration type
    let celebrationType = null;
    if (score === -1 || score === -2) {
      // Birdie or Eagle
      celebrationType = "birdie";
      message += score === -1 ? "Birdie! Excellent!" : "Eagle! Outstanding!";
    } else if (score === 0) {
      celebrationType = "par";
      message += "Par! Great job!";
    } else if (score === 1) {
      celebrationType = "bogey";
      message += "Bogey. Not bad!";
    } else if (score === 2) {
      message += "Double Bogey. Keep trying!";
    } else if (score > 2) {
      message += `${score} over par. Practice makes perfect!`;
    }

    // Show celebration if applicable
    if (celebrationType) {
      showCelebration(celebrationType);
    }

    // Removed game status UI update
    clearHighlights();
    createGrid();
    createBall();
    updateUI();
    return;
  }

  // Check if the new position also has a slope (chain rolling)
  const newSlope = gameState.slopes[newY][newX];
  if (newSlope && newSlope !== SLOPE_DIRECTIONS.NONE) {
    setTimeout(() => {
      rollBall(newSlope);
    }, 500);
  } else {
    clearHighlights();
    createGrid();
    createBall();
    updateUI();
  }
}

function updateUI() {
  document.getElementById("strokeCount").textContent = gameState.strokes;
  document.getElementById("parValue").textContent = gameState.par;

  // Removed dice result UI update

  document.getElementById("rollDice").disabled = gameState.gameOver;
  document.getElementById("putt").disabled = gameState.gameOver;
}

// Complete hole generation (adapted from 2D version)
function generateNewHole() {
  // Reset game state
  gameState.strokes = 0;
  gameState.gameOver = false;
  gameState.lastDiceRoll = 0;
  gameState.lastShotShape = SHOT_SHAPES.STRAIGHT;

  // Clear all tracers for the new hole
  clearAllBallTracers();

  // Initialize grid with all rough
  gameState.grid = [];
  gameState.slopes = [];
  for (let y = 0; y < 32; y++) {
    gameState.grid[y] = [];
    gameState.slopes[y] = [];
    for (let x = 0; x < 16; x++) {
      gameState.grid[y][x] = TILE_TYPES.ROUGH;
      gameState.slopes[y][x] = SLOPE_DIRECTIONS.NONE;
    }
  }

  // Add water hazards first
  addWaterHazards();

  // Place tee in lower third
  placeTee();

  // Place hole in upper half
  placeHole();

  // Calculate par based on distance
  gameState.par = calculatePar(gameState.ballPosition, gameState.holePosition);

  // Add fairway around tee
  addFairwayAroundTee();

  // Add green around hole
  addGreenAroundHole();

  // Add sand traps around green
  addSandTrapsAroundGreen();

  // Add fairway around green + sand traps
  addFairwayAroundGreen();

  // Add connecting fairway between tee and hole
  addConnectingFairway();

  // Sand traps are now added around green tiles in addSandTrapsAroundGreen()

  // Add some trees randomly
  addTrees();

  // Add some sand traps
  addSandTraps();

  // Add slopes to the map
  addSlopes();

  // Create 3D scene
  createGrid();
  createBall();
  createHole();
  updateUI();
}

// Add water hazards
function addWaterHazards() {
  const numWaterHazards = Math.floor(Math.random() * 3); // 0, 1, or 2

  for (let i = 0; i < numWaterHazards; i++) {
    // Find a random position for water
    let startX, startY;
    do {
      startX = Math.floor(Math.random() * 16);
      startY = Math.floor(Math.random() * 32);
    } while (gameState.grid[startY][startX] !== TILE_TYPES.ROUGH);

    // Expand water to 12 tiles
    expandWater(startX, startY, 12);
  }
}

// Expand water from a starting position
function expandWater(startX, startY, targetTiles) {
  const waterTiles = [{ x: startX, y: startY }];
  const visited = new Set();
  visited.add(`${startX},${startY}`);

  while (waterTiles.length < targetTiles && waterTiles.length > 0) {
    const currentTile =
      waterTiles[Math.floor(Math.random() * waterTiles.length)];
    const neighbors = getNeighbors(currentTile.x, currentTile.y);

    // Find valid neighbors to expand to
    const validNeighbors = neighbors.filter((neighbor) => {
      const key = `${neighbor.x},${neighbor.y}`;
      return (
        !visited.has(key) &&
        neighbor.x >= 0 &&
        neighbor.x < 16 &&
        neighbor.y >= 0 &&
        neighbor.y < 32 &&
        gameState.grid[neighbor.y][neighbor.x] === TILE_TYPES.ROUGH
      );
    });

    if (validNeighbors.length > 0) {
      const nextTile =
        validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
      waterTiles.push(nextTile);
      visited.add(`${nextTile.x},${nextTile.y}`);
    } else {
      // Remove this tile if no valid neighbors
      const index = waterTiles.indexOf(currentTile);
      waterTiles.splice(index, 1);
    }
  }

  // Set all water tiles
  waterTiles.forEach((tile) => {
    gameState.grid[tile.y][tile.x] = TILE_TYPES.WATER;
  });
}

// Place tee in lower third
function placeTee() {
  let teeX, teeY;
  do {
    teeX = Math.floor(Math.random() * 16);
    teeY = Math.floor(Math.random() * 11) + 21; // Lower third (rows 21-31)
  } while (gameState.grid[teeY][teeX] === TILE_TYPES.WATER);

  gameState.ballPosition = { x: teeX, y: teeY };
  gameState.grid[teeY][teeX] = TILE_TYPES.TEE;
}

// Place hole in upper half
function placeHole() {
  let holeX, holeY;
  do {
    holeX = Math.floor(Math.random() * 12 + 2);
    holeY = Math.floor(Math.random() * 12 + 2); // Upper half (rows 0-15)
  } while (gameState.grid[holeY][holeX] === TILE_TYPES.WATER);

  gameState.holePosition = { x: holeX, y: holeY };
  gameState.grid[holeY][holeX] = TILE_TYPES.HOLE;
}

// Add fairway around tee
function addFairwayAroundTee() {
  const teePos = gameState.ballPosition;
  const fairwayTiles = [{ x: teePos.x, y: teePos.y }];

  // Add 10 more fairway tiles
  for (let i = 0; i < 10; i++) {
    const currentTile =
      fairwayTiles[Math.floor(Math.random() * fairwayTiles.length)];
    const neighbors = getNeighbors(currentTile.x, currentTile.y);

    const validNeighbors = neighbors.filter((neighbor) => {
      return (
        neighbor.x >= 0 &&
        neighbor.x < 16 &&
        neighbor.y >= 0 &&
        neighbor.y < 32 &&
        gameState.grid[neighbor.y][neighbor.x] === TILE_TYPES.ROUGH
      );
    });

    if (validNeighbors.length > 0) {
      const nextTile =
        validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
      fairwayTiles.push(nextTile);
    }
  }

  // Set all fairway tiles
  fairwayTiles.forEach((tile) => {
    if (gameState.grid[tile.y][tile.x] === TILE_TYPES.ROUGH) {
      gameState.grid[tile.y][tile.x] = TILE_TYPES.FAIRWAY;
    }
  });
}

// Add green tiles around hole (8 adjacent tiles)
function addGreenAroundHole() {
  const holePos = gameState.holePosition;
  const greenTiles = [];

  // Add the 8 adjacent tiles around the hole
  const neighbors = getNeighbors(holePos.x, holePos.y);
  neighbors.forEach((neighbor) => {
    if (
      neighbor.x >= 0 &&
      neighbor.x < 16 &&
      neighbor.y >= 0 &&
      neighbor.y < 32 &&
      gameState.grid[neighbor.y][neighbor.x] === TILE_TYPES.ROUGH
    ) {
      greenTiles.push(neighbor);
    }
  });

  // Add 1-3 more green tiles connected to the initial 8
  const additionalGreenCount = Math.floor(Math.random() * 3) + 1; // 1-3 tiles
  for (let i = 0; i < additionalGreenCount; i++) {
    if (greenTiles.length === 0) break;

    const currentTile =
      greenTiles[Math.floor(Math.random() * greenTiles.length)];
    const neighbors = getNeighbors(currentTile.x, currentTile.y);

    const validNeighbors = neighbors.filter((neighbor) => {
      return (
        neighbor.x >= 0 &&
        neighbor.x < 16 &&
        neighbor.y >= 0 &&
        neighbor.y < 32 &&
        gameState.grid[neighbor.y][neighbor.x] === TILE_TYPES.ROUGH &&
        !greenTiles.some(
          (tile) => tile.x === neighbor.x && tile.y === neighbor.y
        )
      );
    });

    if (validNeighbors.length > 0) {
      const nextTile =
        validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
      greenTiles.push(nextTile);
    }
  }

  // Set all green tiles
  greenTiles.forEach((tile) => {
    gameState.grid[tile.y][tile.x] = TILE_TYPES.GREEN;
  });
}

// Add sand traps around green tiles
function addSandTrapsAroundGreen() {
  const sandTraps = [];

  // Find all green tiles
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 16; x++) {
      if (gameState.grid[y][x] === TILE_TYPES.GREEN) {
        const neighbors = getNeighbors(x, y);
        neighbors.forEach((neighbor) => {
          if (
            neighbor.x >= 0 &&
            neighbor.x < 16 &&
            neighbor.y >= 0 &&
            neighbor.y < 32 &&
            gameState.grid[neighbor.y][neighbor.x] === TILE_TYPES.ROUGH &&
            Math.random() < 0.4 // 40% chance for sand trap
          ) {
            sandTraps.push(neighbor);
          }
        });
      }
    }
  }

  // Set all sand trap tiles
  sandTraps.forEach((tile) => {
    gameState.grid[tile.y][tile.x] = TILE_TYPES.SAND;
  });
}

// Add fairway around green + sand traps
function addFairwayAroundGreen() {
  const fairwayTiles = [];

  // Find all green and sand tiles to build around
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 16; x++) {
      if (
        gameState.grid[y][x] === TILE_TYPES.GREEN ||
        gameState.grid[y][x] === TILE_TYPES.SAND
      ) {
        const neighbors = getNeighbors(x, y);
        neighbors.forEach((neighbor) => {
          if (
            neighbor.x >= 0 &&
            neighbor.x < 16 &&
            neighbor.y >= 0 &&
            neighbor.y < 32 &&
            gameState.grid[neighbor.y][neighbor.x] === TILE_TYPES.ROUGH &&
            Math.random() < 0.6 // 60% chance for fairway
          ) {
            fairwayTiles.push(neighbor);
          }
        });
      }
    }
  }

  // Set all fairway tiles
  fairwayTiles.forEach((tile) => {
    if (gameState.grid[tile.y][tile.x] === TILE_TYPES.ROUGH) {
      gameState.grid[tile.y][tile.x] = TILE_TYPES.FAIRWAY;
    }
  });
}

// Add connecting fairway between tee and hole
function addConnectingFairway() {
  const teePos = gameState.ballPosition;
  const holePos = gameState.holePosition;

  // Calculate the direct path between tee and hole
  const dx = holePos.x - teePos.x;
  const dy = holePos.y - teePos.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));

  // Create a path with some randomness
  const pathTiles = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const baseX = Math.round(teePos.x + dx * t);
    const baseY = Math.round(teePos.y + dy * t);

    // Add some randomness to the path
    const randomOffset = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    const pathX = Math.max(0, Math.min(15, baseX + randomOffset));
    const pathY = Math.max(0, Math.min(31, baseY + randomOffset));

    if (gameState.grid[pathY][pathX] === TILE_TYPES.ROUGH) {
      pathTiles.push({ x: pathX, y: pathY });
    }
  }

  // Add the path tiles as fairway
  pathTiles.forEach((tile) => {
    gameState.grid[tile.y][tile.x] = TILE_TYPES.FAIRWAY;
  });

  // Add some additional fairway tiles around the path
  const additionalFairwayTiles = [];
  pathTiles.forEach((tile) => {
    const neighbors = getNeighbors(tile.x, tile.y);
    neighbors.forEach((neighbor) => {
      if (
        neighbor.x >= 0 &&
        neighbor.x < 16 &&
        neighbor.y >= 0 &&
        neighbor.y < 32 &&
        gameState.grid[neighbor.y][neighbor.x] === TILE_TYPES.ROUGH &&
        Math.random() < 0.6
      ) {
        // 30% chance to add adjacent fairway
        additionalFairwayTiles.push(neighbor);
      }
    });
  });

  // Add the additional fairway tiles
  additionalFairwayTiles.forEach((tile) => {
    gameState.grid[tile.y][tile.x] = TILE_TYPES.FAIRWAY;
  });
}

// Add sand traps near the hole on the sides of the fairway
function addSandTrapsNearHole() {
  const holePos = gameState.holePosition;

  // Find fairway tiles near the hole
  const fairwayTiles = [];
  for (
    let y = Math.max(0, holePos.y - 3);
    y <= Math.min(31, holePos.y + 3);
    y++
  ) {
    for (
      let x = Math.max(0, holePos.x - 3);
      x <= Math.min(15, holePos.x + 3);
      x++
    ) {
      if (gameState.grid[y][x] === TILE_TYPES.FAIRWAY) {
        fairwayTiles.push({ x, y });
      }
    }
  }

  // Add sand traps on the sides of fairway tiles near the hole
  fairwayTiles.forEach((tile) => {
    const neighbors = getNeighbors(tile.x, tile.y);
    neighbors.forEach((neighbor) => {
      if (
        neighbor.x >= 0 &&
        neighbor.x < 16 &&
        neighbor.y >= 0 &&
        neighbor.y < 32 &&
        gameState.grid[neighbor.y][neighbor.x] === TILE_TYPES.ROUGH &&
        Math.random() < 0.15
      ) {
        // 15% chance to add sand trap
        gameState.grid[neighbor.y][neighbor.x] = TILE_TYPES.SAND;
      }
    });
  });
}

// Add some trees randomly
function addTrees() {
  // Create tree clusters instead of random placement
  const numClusters = Math.floor(Math.random() * 4) + 3; // 3-6 clusters
  const treesPerCluster = Math.floor(Math.random() * 8) + 5; // 5-12 trees per cluster
  const totalTrees = numClusters * treesPerCluster; // 15-72 total trees

  for (let cluster = 0; cluster < numClusters; cluster++) {
    // Choose cluster center
    let centerX, centerY;
    do {
      centerX = Math.floor(Math.random() * 16);
      centerY = Math.floor(Math.random() * 32);
    } while (gameState.grid[centerY][centerX] !== TILE_TYPES.ROUGH);

    // Place trees around the cluster center
    for (let tree = 0; tree < treesPerCluster; tree++) {
      let treeX, treeY;
      let attempts = 0;

      do {
        // Create a cluster by placing trees within a radius of the center
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 3 + 1; // 1-4 tiles from center

        treeX = Math.round(centerX + Math.cos(angle) * distance);
        treeY = Math.round(centerY + Math.sin(angle) * distance);

        // Keep within bounds
        treeX = Math.max(0, Math.min(15, treeX));
        treeY = Math.max(0, Math.min(31, treeY));

        attempts++;
        // Give up after 10 attempts to avoid infinite loops
        if (attempts > 10) break;
      } while (gameState.grid[treeY][treeX] !== TILE_TYPES.ROUGH);

      // Place the tree if we found a valid spot
      if (attempts <= 10 && gameState.grid[treeY][treeX] === TILE_TYPES.ROUGH) {
        gameState.grid[treeY][treeX] = TILE_TYPES.TREE;
      }
    }
  }

  console.log(
    `Generated ${numClusters} tree clusters with ~${treesPerCluster} trees each (${totalTrees} total trees)`
  );
}

// Add some sand traps
function addSandTraps() {
  const numSandTraps = Math.floor(Math.random() * 4) + 2; // 2-5 sand traps

  for (let i = 0; i < numSandTraps; i++) {
    let sandX, sandY;
    do {
      sandX = Math.floor(Math.random() * 16);
      sandY = Math.floor(Math.random() * 32);
    } while (gameState.grid[sandY][sandX] !== TILE_TYPES.ROUGH);

    gameState.grid[sandY][sandX] = TILE_TYPES.SAND;
  }
}

// Add slopes to the map
function addSlopes() {
  const slopeDirections = [
    SLOPE_DIRECTIONS.NORTH,
    SLOPE_DIRECTIONS.NORTHEAST,
    SLOPE_DIRECTIONS.EAST,
    SLOPE_DIRECTIONS.SOUTHEAST,
    SLOPE_DIRECTIONS.SOUTH,
    SLOPE_DIRECTIONS.SOUTHWEST,
    SLOPE_DIRECTIONS.WEST,
    SLOPE_DIRECTIONS.NORTHWEST,
  ];

  const numSlopes = Math.floor(Math.random() * 20) + 20; // 20-39 slopes

  for (let i = 0; i < numSlopes; i++) {
    let slopeX, slopeY;
    do {
      slopeX = Math.floor(Math.random() * 16);
      slopeY = Math.floor(Math.random() * 32);
    } while (
      gameState.grid[slopeY][slopeX] === TILE_TYPES.WATER ||
      gameState.grid[slopeY][slopeX] === TILE_TYPES.TREE ||
      gameState.grid[slopeY][slopeX] === TILE_TYPES.SAND ||
      gameState.grid[slopeY][slopeX] === TILE_TYPES.HOLE ||
      gameState.slopes[slopeY][slopeX] !== SLOPE_DIRECTIONS.NONE
    );

    // Randomly select a slope direction
    const randomSlope =
      slopeDirections[Math.floor(Math.random() * slopeDirections.length)];
    gameState.slopes[slopeY][slopeX] = randomSlope;
  }
}

// Calculate shot shape offset based on flight direction
function calculateShotShapeOffset(flightDirection, shotShape) {
  if (shotShape === SHOT_SHAPES.STRAIGHT) {
    return { x: 0, y: 0 };
  }

  const config = SHOT_SHAPE_CONFIGS[shotShape];
  if (!config) {
    return { x: 0, y: 0 };
  }

  // Normalize flight direction to get unit vector
  const length = Math.sqrt(
    flightDirection.dx * flightDirection.dx +
      flightDirection.dy * flightDirection.dy
  );
  const unitDx = length > 0 ? flightDirection.dx / length : 0;
  const unitDy = length > 0 ? flightDirection.dy / length : 0;

  // Calculate perpendicular vector (rotate 90 degrees counterclockwise)
  // For vector (dx, dy), perpendicular is (-dy, dx)
  const perpDx = -unitDy;
  const perpDy = unitDx;

  // Apply the configured offset magnitude in the perpendicular direction
  return {
    x: Math.round(perpDx * config.offset.x),
    y: Math.round(perpDy * config.offset.x),
  };
}

// Get neighbors of a position
function getNeighbors(x, y) {
  return [
    { x: x - 1, y: y - 1 },
    { x: x, y: y - 1 },
    { x: x + 1, y: y - 1 },
    { x: x - 1, y: y },
    { x: x + 1, y: y },
    { x: x - 1, y: y + 1 },
    { x: x, y: y + 1 },
    { x: x + 1, y: y + 1 },
  ];
}

// Dynamically generate dice selection UI from DICE_TYPES configuration
function generateDiceSelectionUI() {
  const diceSelectionContainer = document.getElementById("diceSelection");
  if (!diceSelectionContainer) return;

  // Clear existing dice options
  diceSelectionContainer.innerHTML = "";

  // Generate dice option for each dice type
  Object.keys(DICE_TYPES).forEach((diceId) => {
    const diceType = DICE_TYPES[diceId];
    const diceIdNum = parseInt(diceId);

    // Create dice option div
    const diceOption = document.createElement("div");
    diceOption.className = "dice-option";
    diceOption.id = `dice${diceIdNum}`;

    // Add selected class if this is the currently selected dice
    if (diceIdNum === gameState.selectedDice) {
      diceOption.classList.add("selected");
    }

    // Create content with dice name and faces, each face as a white square div
    diceOption.innerHTML = `
      ${diceType.name}<br />
      <div style="display: flex; flex-direction: row; gap: 6px; margin-top: 4px;">
        ${diceType.faces
          .map(
            (face) => `
              <div style="
                width: 20px;
                height: 20px;
                background: #fff;
                border: 2px solid #f80800;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: semibold;
                color: #222;
                box-shadow: 0 1px 2px rgba(0,0,0,0.07);
              ">${face}</div>
            `
          )
          .join("")}
      </div>
    `;

    // Add click handler
    diceOption.onclick = () => selectDice(diceIdNum);

    // Add to container
    diceSelectionContainer.appendChild(diceOption);
  });
}

// Change the number of dice to roll
function changeDiceAmount(delta) {
  diceAmount = Math.max(1, Math.min(12, diceAmount + delta));
  document.getElementById("diceAmount").textContent = diceAmount;
}

// Toggle dice selection visibility
function toggleDiceSelection() {
  const diceSelection = document.getElementById("diceSelection");
  const toggleButton = document.getElementById("toggleDice");

  if (diceSelection.classList.contains("hidden")) {
    // Show dice selection
    diceSelection.classList.remove("hidden");
    toggleButton.textContent = "Clubs";
    toggleButton.classList.add("cta-btn");
  } else {
    // Hide dice selection
    diceSelection.classList.add("hidden");
    toggleButton.textContent = "Clubs";
    toggleButton.classList.remove("cta-btn");
  }
}

// Initialize dice selection as hidden
function initDiceSelectionVisibility() {
  const diceSelection = document.getElementById("diceSelection");
  const toggleButton = document.getElementById("toggleDice");

  if (diceSelection && toggleButton) {
    diceSelection.classList.add("hidden");
    toggleButton.textContent = "Clubs";
    toggleButton.classList.remove("cta-btn");
  }
}

// Make functions globally accessible for HTML onclick handlers
window.selectDice = selectDice;
window.rollDice = rollDice;
window.putt = putt;
window.generateNewHole = generateNewHole;
window.transitionToNewHole = transitionToNewHole;
window.performCameraSweep = performCameraSweep;
window.positionCameraOnHole = positionCameraOnHole;
window.toggleDiceSelection = toggleDiceSelection;
window.changeDiceAmount = changeDiceAmount;

// Initialize game
function initGame() {
  initThreeJS();
  initPhysicsWorld(); // Initialize physics world
  initPostProcessing(); // Initialize post-processing effects
  initBallTracer(); // Initialize ball tracer system
  initCelebrationSystem(); // Initialize celebration system
  initTransitionSystem(); // Initialize transition system
  addClickHandler();

  // Generate UI components from configuration
  generateDiceSelectionUI();

  // Initialize dice selection as hidden
  initDiceSelectionVisibility();

  // For initial hole generation, don't use transition (show immediately)
  generateNewHole();
}

// Start the game
initGame();
