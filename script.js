
/* =========================
   IMPORTS THREE.JS (OBRIGATÓRIO)
========================= */
import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { ColladaLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/ColladaLoader.js";

/* =========================
   ELEMENTOS
========================= */
const field = document.getElementById("field");
const ball = document.getElementById("ball");
const hint = document.getElementById("hint");
const targets = document.querySelectorAll(".target");
let gameReady = false;

function shootConfetti(x, y) {
    const rect = field.getBoundingClientRect();

    const origin = {
        x: (x - rect.left) / rect.width,
        y: (y - rect.top) / rect.height
    };

    // 🎉 PRIMEIRA EXPLOSÃO
    confetti({
        particleCount: 90,
        spread: 70,
        origin,
        colors: ["#0b3c89", "#ffffff"], // azul Rutra + branco
        gravity: 0.9,
        scalar: 1.1,
        ticks: 200
    });

    // 🎉 SEGUNDA EXPLOSÃO (delay curto)
    setTimeout(() => {
        confetti({
            particleCount: 70,
            spread: 110,
            origin,
            colors: ["#0b3c89", "#ffffff"],
            gravity: 1,
            scalar: 0.9,
            ticks: 180
        });
    }, 140);
}


/* =========================
   CONFIGURAÇÃO
========================= */
const MIN_DRAG_TO_SHOOT = 18;
const MAX_DRAG = 80;

const POWER = 0.15;
const GRAVITY = 0.26;

const GROUND_RATIO = 0.88;        // posição inicial da bola
const GOAL_GROUND_RATIO = 0.60;   // chão do gol (mais embaixo)

const BOUNCE_DAMPING = 0.45;
const STOP_THRESHOLD = 1.2;

/* =========================
   ESTADO
========================= */
let dragging = false;
let shot = false;
let shotPower = 0;

let start = { x: 0, y: 0 };
let dragVector = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let enteringGoal = false;
let goalProgress = 0;

/* =========================
   HINT
========================= */
function showHint(text, color = "#ffffff") {
    hint.innerText = text;
    hint.style.color = color;
    hint.classList.remove("hide");
    hint.classList.add("show");
}

function hideHint() {
    hint.classList.remove("show");
    hint.classList.add("hide");
}

showHint("");
/* =========================
   GOL 3D — TRAVE (.DAE)
========================= */
const goalCanvas = document.getElementById("goal3d");
const goalScene = new THREE.Scene();

const goalCamera = new THREE.PerspectiveCamera(
    50,
    field.offsetWidth / field.offsetHeight,
    0.1,
    100
);

// câmera estilo pênalti
goalCamera.position.set(0, 1.4, 4.2);
goalCamera.lookAt(0, 1.1, 0);

const goalRenderer = new THREE.WebGLRenderer({
    canvas: goalCanvas,
    alpha: true,
    antialias: true
});

goalRenderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
goalRenderer.setSize(field.offsetWidth, field.offsetHeight);
goalRenderer.setClearColor(0x000000, 0); // fundo transparente

/* luz simples */
goalScene.add(new THREE.AmbientLight(0xffffff, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(3, 5, 3);
goalScene.add(sun);

/* carregar TRAVE .DAE */
const daeLoader = new ColladaLoader();

daeLoader.load(
    "assets/trave.dae",   // 👈 CONFIRA O NOME
    (collada) => {
        const goal = collada.scene;

        /* 🔥 Collada geralmente vem MUITO grande */
        goal.scale.setScalar(0.01); // ajuste base (0.005–0.05)

        /* centraliza corretamente */
        const box = new THREE.Box3().setFromObject(goal);
        const center = box.getCenter(new THREE.Vector3());
        goal.position.sub(center);

        /* ajuste fino visual */
        goal.position.y += 0.99;   // sobe a trave
        goal.position.z -= 0.9;    // empurra pra dentro do gol

        goalScene.add(goal);
    },
    undefined,
    (err) => {
        console.error("Erro ao carregar trave.dae:", err);
    }
);
/* =========================
   ENTROU NO GOL (SEM ACERTAR ALVO)
========================= */


/* loop */
function renderGoal() {
    requestAnimationFrame(renderGoal);
    goalRenderer.render(goalScene, goalCamera);
}
renderGoal();

/* resize */
window.addEventListener("resize", () => {
    const w = field.offsetWidth;
    const h = field.offsetHeight;
    goalCamera.aspect = w / h;
    goalCamera.updateProjectionMatrix();
    goalRenderer.setSize(w, h);
});

/* =========================
   HELPERS
========================= */
const fieldRect = () => field.getBoundingClientRect();

function rectsCollide(a, b) {
    return !(
        a.right < b.left ||
        a.left > b.right ||
        a.bottom < b.top ||
        a.top > b.bottom
    );
}
/* =========================
   BOLA 3D (THREE.JS) — CORRIGIDO (VISUALIZAÇÃO)
========================= */

const canvas3D = document.getElementById("ball3d");

const SIZE = 200; // mantém como está (não é o problema)

const scene = new THREE.Scene();

/* 🔥 CORREÇÃO PRINCIPAL: FOV + câmera */
const camera = new THREE.PerspectiveCamera(
    65,   // FOV maior (antes 45 ❌)
    1,
    0.1,
    100
);
const startScreen = document.getElementById("startScreen");
const playBtn = document.getElementById("playBtn");
const game = document.getElementById("game");

playBtn.addEventListener("click", () => {
    startScreen.style.opacity = "0";
    startScreen.style.pointerEvents = "none";
    game.classList.remove("blurred");

    gameReady = true;
    // showHint("ARRASTE A BOLA PARA CHUTAR");

    requestAnimationFrame(loop);

    setTimeout(() => {
        startScreen.remove();
    }, 500);
});

// câmera mais distante e menos inclinada
camera.position.set(0, 1.8, 3.8);
camera.lookAt(0, 1.0, 0);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas3D,
    alpha: true,
    antialias: true
});

// resolução real
const DPR = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(DPR);
renderer.setSize(SIZE, SIZE, false);

/* iluminação */
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(3, 5, 2);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
rimLight.position.set(-3, 2, -2);
scene.add(rimLight);

/* carregar bola */
let ball3D;
const loader = new GLTFLoader();

loader.load("assets/ball.glb", (gltf) => {
    ball3D = gltf.scene;
    ball3D.scale.set(1.7, 1.7, 1.7);

    // 🔥 correção fina: centraliza APENAS no eixo Y
    const box = new THREE.Box3().setFromObject(ball3D);
    const center = box.getCenter(new THREE.Vector3());
    ball3D.position.y -= center.y;

    scene.add(ball3D);
});

/* loop */
function renderBall3D() {
    requestAnimationFrame(renderBall3D);

    // 🔒 bola parada antes do chute
    if (ball3D && shot) {
        ball3D.rotation.x += velocity.y * 0.10;
        ball3D.rotation.z += velocity.x * 0.10;
    }

    renderer.render(scene, camera);
}


renderBall3D();

/* =========================
   RESET
========================= */
const extraOffset = 105;
let gameStarted = false;

function resetBall(initial = false) {
    const r = fieldRect();

    // 🔥 se for início do jogo, sobe mais ainda
    const extraOffset = initial ? 55 : 35;

    const left = `${r.width / 2}px`;
    const top = `${(r.height * GROUND_RATIO) - extraOffset}px`;
    const transform = "translate(-50%, -50%) scale(1)";

    ball.style.left = left;
    ball.style.top = top;
    ball.style.transform = transform;

    canvas3D.style.left = left;
    canvas3D.style.top = top;
    canvas3D.style.transform = transform;

    velocity.x = 0;
    velocity.y = 0;
    dragVector.x = 0;
    dragVector.y = 0;

    dragging = false;
    shot = false;

    showHint("");
}


function resetTargets() {
    targets.forEach(t => {
        t.classList.remove("hidden");
        t.dataset.hit = "false"; // 🔄 reativa colisão
        t.style.background = "";
        t.style.boxShadow = "";
        t.style.animation = "";
        t.style.transform = "scale(1)";
    });
}



/* =========================
   INPUT — POINTER DOWN
========================= */
ball.addEventListener("pointerdown", (e) => {
    if (shot) return;

    dragging = true;
    ball.setPointerCapture(e.pointerId);

    const r = fieldRect();
    start.x = e.clientX - r.left;
    start.y = e.clientY - r.top;

    // showHint("SOLTE PARA CHUTAR", "#3b82f6");
});

/* =========================
   INPUT — POINTER MOVE
========================= */
field.addEventListener("pointermove", (e) => {
    if (!dragging || shot) return;

    const r = fieldRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    let dx = x - start.x;
    let dy = y - start.y;

    // só permite puxar para cima
    dy = Math.min(dy, 0);

    const dist = Math.hypot(dx, dy);
    if (dist > MAX_DRAG) {
        const ratio = MAX_DRAG / dist;
        dx *= ratio;
        dy *= ratio;
    }

    dragVector.x = dx;
    dragVector.y = dy;

    const scale = 1 - dist / (MAX_DRAG * 2.5);
    ball.style.transform = `translate(-50%, -50%) scale(${scale})`;
});

/* =========================
   INPUT — POINTER UP (CHUTE)
========================= */
ball.addEventListener("pointerup", () => {
    if (!dragging) return;

    dragging = false;

    const dist = Math.hypot(dragVector.x, dragVector.y);
    if (dist < MIN_DRAG_TO_SHOOT) {
        showHint("PUXE MAIS FORTE",);
        setTimeout(resetBall, 600);
        return;
    }

    shot = true;
    hideHint();

    shotPower = Math.min(dist / MAX_DRAG, 1);

    // deslocamento lateral (diagonal visível)
    velocity.x = dragVector.x * POWER * 1.8;

    // impulso vertical inicial (parabólico)
    velocity.y =
        dragVector.y * POWER * (0.9 + shotPower * 0.6)
        - (2.4 + shotPower * 1.6);
});

/* =========================
   COLISÃO COM ALVOS 🎯
========================= */
function checkTargetHit() {
    const ballRect = ball.getBoundingClientRect();

    const ballCX = ballRect.left + ballRect.width / 2;
    const ballCY = ballRect.top + ballRect.height / 2;

    for (const target of targets) {

        // ❌ alvo já foi acertado → ignora totalmente
        if (target.dataset.hit === "true") continue;

        const tRect = target.getBoundingClientRect();

        const targetCX = tRect.left + tRect.width / 2;
        const targetCY = tRect.top + tRect.height / 2;

        const dx = ballCX - targetCX;
        const dy = ballCY - targetCY;
        const distance = Math.hypot(dx, dy);

        const targetRadius = tRect.width * 0.25;
        const ballRadius = ballRect.width * 0.45;

        if (distance < targetRadius + ballRadius) {
            hitTarget(target);
            return true;
        }
    }

    return false;
}



function hitTarget(target) {
    shot = false;

    // 🔒 desativa definitivamente este alvo
    target.dataset.hit = "true";

    // posição do alvo
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    shootConfetti(centerX, centerY);

    // some a bola
    ball.style.opacity = "0";
    canvas3D.style.opacity = "0";

    if (ball3D) ball3D.visible = false;

    // some o alvo visualmente
    target.classList.add("hidden");

    showHint("GOLAÇO!");

    setTimeout(() => {
        resetBall();

        canvas3D.style.opacity = "1";
        if (ball3D) ball3D.visible = true;
    }, 1000);
}




/* =========================
   FÍSICA DA BOLA
========================= */
function updateBall() {
    if (!shot) return;

    const fieldH = field.offsetHeight;
    const fieldW = field.offsetWidth;

    /* =========================
       ANIMAÇÃO: BOLA ENTRANDO NO GOL
    ========================= */
    if (enteringGoal) {
        goalProgress += 0.05;

        const zScale = 1 - goalProgress * 0.6;
        const fade = 1 - goalProgress;

        ball.style.transform = `translate(-50%, -50%) scale(${zScale})`;
        ball.style.opacity = fade;

        canvas3D.style.transform = ball.style.transform;
        canvas3D.style.opacity = fade;

        if (ball3D) {
            ball3D.rotation.x += 0.1;
            ball3D.rotation.z += 0.08;
            ball3D.scale.setScalar(1.7 * zScale);
        }

        if (goalProgress >= 1) {
            enteringGoal = false;
            shot = false;

            showHint("DEFESA DO GOLEIRO!");

            setTimeout(() => {
                ball.style.opacity = "1";
                canvas3D.style.opacity = "1";
                resetBall();
            }, 900);
        }

        return; // ⛔ impede física normal
    }

    /* =========================
       FÍSICA BÁSICA
    ========================= */
    velocity.y += GRAVITY;
    velocity.x *= 0.99;
    velocity.y *= 0.99;

    const nextX = ball.offsetLeft + velocity.x;
    const nextY = ball.offsetTop + velocity.y;

    /* =========================
       PROFUNDIDADE VISUAL REAL
    ========================= */
    const goalVisualLine = fieldH * 0.52;

    if (nextY > goalVisualLine) {
        ball.style.zIndex = "3";
        canvas3D.style.zIndex = "3";
    } else {
        ball.style.zIndex = "6";
        canvas3D.style.zIndex = "6";
    }

    /* =========================
       APLICA POSIÇÃO
    ========================= */
    ball.style.left = `${nextX}px`;
    ball.style.top = `${nextY}px`;

    /* =========================
       PROFUNDIDADE (PERSPECTIVA)
    ========================= */
    const progress = 1 - nextY / fieldH;
    const scale = Math.min(0.85, 0.45 + progress * 0.55);

    ball.style.transform = `translate(-50%, -50%) scale(${scale})`;

    /* =========================
       SINCRONIZA BOLA 3D
    ========================= */
    canvas3D.style.left = ball.style.left;
    canvas3D.style.top = ball.style.top;
    canvas3D.style.transform = ball.style.transform;

    if (ball3D) {
        ball3D.rotation.x += velocity.y * 0.015;
        ball3D.rotation.z += velocity.x * 0.015;
    }

    /* =========================
       COLISÃO COM ALVOS 🎯
    ========================= */
    if (nextY <= fieldH * 0.55 && checkTargetHit()) {
        shot = false;
        return;
    }

    /* =========================
       CHÃO DO GOL (QUICAR)
    ========================= */
    const goalGroundY = fieldH * GOAL_GROUND_RATIO;

    if (velocity.y > 0 && nextY >= goalGroundY) {
        ball.style.top = `${goalGroundY}px`;

        if (Math.abs(velocity.y) > STOP_THRESHOLD) {
            velocity.y = -velocity.y * BOUNCE_DAMPING;
            velocity.x *= 0.88;
        } else {
            velocity.x = 0;
            velocity.y = 0;
            shot = false;

            if (ball3D) {
                ball3D.rotation.x = 0;
                ball3D.rotation.z = 0;
            }

            showHint("NÃO FOI DESSA VEZ");
            setTimeout(resetBall, 1200);
        }
    }

    /* =========================
       FORA DO CAMPO
    ========================= */
    if (
        nextY < -120 ||
        nextX < -120 ||
        nextX > fieldW + 120
    ) {
        velocity.x = 0;
        velocity.y = 0;
        shot = false;

        if (ball3D) {
            ball3D.rotation.x = 0;
            ball3D.rotation.z = 0;
        }

        showHint("PRA FORA!");
        setTimeout(resetBall, 900);
    }
}



/* =========================
   LOOP
========================= */
function loop() {
    if (!gameReady) return;
    updateBall();
    requestAnimationFrame(loop);
}


/* START */
/* START */
requestAnimationFrame(() => {
    resetBall(true);
    game.classList.add("blurred");
});
