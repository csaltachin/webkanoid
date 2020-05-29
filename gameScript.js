// ======================================================================================================================================
// 
// webkanoid
// by Carlos Solano | csaltachin@gmail.com | repository at https://github.com/csaltachin/webkanoid
// -----------------------------------------------------------------------------------------------
// A simple Arkanoid/Breakout-style game, in pure JavaScript. Uses the Canvas API to draw graphics
// in a 2D context, as well as the AudioContext interface for buffered sound effects. These are
// obtained via XHR.
// 
// ======================================================================================================================================


// Global stuff
var BUFFER_DIR = "";
var canvas = document.getElementById("gameCanvas");
var ctx = canvas.getContext("2d");
var GLOBAL_FONT = "Consolas";

// Draw "loading..." text
ctx.font = "Bold 32px Courier";
var loadingTextWidth = ctx.measureText("loading...").width;
ctx.fillStyle = "#000000";
ctx.fillText("loading...", canvas.width/2 - loadingTextWidth/2, canvas.height/2);


// ======================================================================================================================================
// Audio
// ======================================================================================================================================
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCTX = new AudioContext();
var DEFAULT_VOL = 0.35;
var MUTED = false;
// Buffers for all sound effects
var SOUND_BUFFERS = {
    welcome: null,
    bounce_low: null,
    bounce_high: null,
    back_to_menu: null,
    climb: null, // Debug sound
}

// Loads a sound file at {url} as a buffer, and binds it to a variable named "buffer_placeholder" in object "obj" (or window if none)
function loadSoundIntoBuffer(url, holder_name, obj) {
    let req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = "arraybuffer";
    req.onload = function() {
        let data = req.response;
        audioCTX.decodeAudioData(
            data,
            function(buffer) {
                if(typeof obj == "undefined") {
                    window[holder_name] = buffer;
                }
                else {
                    obj[holder_name] = buffer;
                }
                //console.log("> Sound file at " + url + " was succesfully loaded into a buffer!");
            },
            function(e) {
                console.log("> Error decoding sound file at " + url + ": " + e.err);
            }
        ).then(
            function() {
                //console.log("DEBUG > Request to get [" + url + "] just loaded!");
            },
            function() {
                console.log("> Request to get [" + url + "] failed.");
            }
        );
    };
    req.send();
}

// Plays sound from given AudioBuffer
function playFromBuffer(buffer) {
    if(!MUTED) {
        let source = audioCTX.createBufferSource();
        source.buffer = buffer;
        source.connect(volumeGate);
        source.onended = function() {
            //console.log("Finished playing a sound from a buffer.");
        }
        source.start();
    }
}

// Shorthand for playing sound from name
function playFromName(name) {
    playFromBuffer(SOUND_BUFFERS[name]);
}

// Sets up audioCTX to be ready for sound playback
function setupAudioContext() {
    // Create gain node for global volume control
    volumeGate = audioCTX.createGain();
    volumeGate.gain.value = DEFAULT_VOL; // Set default volume for the whole AudioContext
    volumeGate.connect(audioCTX.destination);
    // Load buffers for all sounds listed in SOUND_BUFFERS
    for(let name in SOUND_BUFFERS) {
        loadSoundIntoBuffer(`${BUFFER_DIR}fx/${name}.ogg`, name, SOUND_BUFFERS);
    }
}

// Check if audioCTX is suspended, if so try to resume
function checkAudio() {
    if(audioCTX.state == "suspended") {
        audioCTX.resume().then(
            function() {
                console.log("> AudioContext: audioCTX resumed succesfully!");
            },
            function() {
                console.log("> Failed to resume AudioContext: audioCTX.")
            }
        );
    }
}


// ======================================================================================================================================
// Game elements
// ======================================================================================================================================
var gameBall;
var gamePaddle;

var bricks = [];
var brickRowCount = 14;
var brickColumnCount = 14;
var brickWidth = 75;
var brickHeight = 20;
var brickPadding = 10;
var brickOffsetTop = 30;
var brickOffsetLeft = 50;
var strokeBrick = true;


// ======================================================================================================================================
// Score, states
// ======================================================================================================================================
var score = 0;
var highScore = 0;
var fastArrowKeys = false;
var showFPS = false;

var LEVELS;
var CURRENT_LEVEL = 0; // Level at game start
const AVAILABLE_LEVELS = 2; // Total existing levels so far

var GAME_STATE;
const STATES = {
    WELCOME: 0,
    STEADY: 1,
    ALIVE: 2, 
    GAMEOVER: 3.
}
var steadyCanStart = false;
var steadyClicked = false;

var rightPressed = false;
var leftPressed = false;
var spacePressed = false;
var xPressed = false;
var tPressed = false;
var aPressed = false;
var dPressed = false;


// ======================================================================================================================================
// Class definitions for Ball, Paddle
// ======================================================================================================================================
class Ball {
    constructor(r) {
        this.radius = r;
        this.x = 0;
        this.y = 0;
        this.dx = 0;
        this.dy = 0;
        this.color = "#0095DD"; // Default ball color
    }
    initPos(x, y, dx, dy) {
        this.x = x;
        this.y = y;
    }
    initVel(dx, dy) {
        this.dx = dx;
        this.dy = dy;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
    speedUp(factor) {
        this.dx = factor*this.dx;
        this.dy = factor*this.dy;
    }
}

class Paddle {
    constructor(width, height, hover) {
        this.width = width;
        this.height = height;
        this.hover = hover;
        this.x = 0;
    }
    init() {
        this.x = (canvas.width-this.width)/2;
    }
    draw() {
        ctx.beginPath();
        ctx.rect(this.x, canvas.height-this.height-this.hover, this.width, this.height);
        ctx.fillStyle = "#40414a";
        ctx.fill();
        ctx.closePath();
    }
}


// ======================================================================================================================================
// Level fetching/loading
// ======================================================================================================================================
function loadLevel(level_num) {
    let filename = level_num + ".json";
    if(level_num < 10) {
        filename = "0" + filename;
    }
    // Get level json via XHR
    let req = new XMLHttpRequest();
    req.open("GET", `levels/${filename}`, true);
    req.responseType = "json";
    req.onload = function() {
        console.log(`Loaded level ${level_num} [${req.response.name}]`);
        LEVELS[level_num] = req.response;
    };
    req.send();
}
function loadAllLevels() {
    for(i = 0; i < AVAILABLE_LEVELS; i++) {
        loadLevel(i);
    }
}
function previousLevel() {
    CURRENT_LEVEL--;
    if(CURRENT_LEVEL < 0) {
        CURRENT_LEVEL = AVAILABLE_LEVELS - 1; // Set to last
    }
    initBricks(LEVELS[CURRENT_LEVEL].grid)
}
function nextLevel() {
    CURRENT_LEVEL++;
    if(CURRENT_LEVEL == AVAILABLE_LEVELS) {
        CURRENT_LEVEL = 0; // Set to first
    }
    initBricks(LEVELS[CURRENT_LEVEL].grid)
}


// ======================================================================================================================================
// Initializer methods
// ======================================================================================================================================
function initBall() {
    // Using default dimensions
    var b = new Ball(8);
    b.initPos(canvas.width/2, canvas.height-32);
    return b;
}
function initPaddle() {
    // Using default dimensions
    var p = new Paddle(75, 10, 15);
    p.init();
    return p;
}
function initBricks(level_grid) {
    let grid_given = level_grid != "undefined";
    for(var c=0; c<brickColumnCount; c++) {
        bricks[c] = [];
        for(var r=0; r<brickRowCount; r++) {
            let this_status = 1; // Default to full grid (same as 00 default)
            if(grid_given) {
                this_status = level_grid[r][c]; // Transpose, so that grid looks the same in-game as in the json file
            }
            bricks[c][r] = {
                x: c*(brickWidth+brickPadding) + brickOffsetLeft,
                y: r*(brickHeight+brickPadding) + brickOffsetTop,
                status: this_status,
            }
        }
    }
}
function initGame() {
    initBricks(LEVELS[CURRENT_LEVEL].grid);
    gameBall = initBall();
    gamePaddle = initPaddle();
    score = 0;
}


// ======================================================================================================================================
// Add key/mouse listeners
// ======================================================================================================================================
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
document.addEventListener("mousemove", mouseMoveHandler, false);
canvas.onclick = clickHandler;


// ======================================================================================================================================
// Handler methods
// ======================================================================================================================================
function keyDownHandler(e) {
    // Resume audio if suspended (autoplay restrictions)
    checkAudio();
    // Handle each key
    switch(e.key) {
        case "Right":
        case "ArrowRight":
            rightPressed = true;
            break;
        case "Left":
        case "ArrowLeft":
            leftPressed = true;
            break;
        case " ":
            spacePressed = true;
            break;
        case "M":
        case "m":
            MUTED = !MUTED;
            break;
        case "Z":
        case "z":
            fastArrowKeys = true;
            break;
        case "X":
        case "x":
            xPressed = true;
            break;
        case "T":
        case "t":
            if(!tPressed && audioCTX.state != "suspended") {
                playFromBuffer(SOUND_BUFFERS.climb);
                showFPS = !showFPS;
            }
            tPressed = true;
            break;
        case "A":
        case "a":
            if(!aPressed && GAME_STATE == STATES.STEADY) {
                // Init previous level
                previousLevel();

            }
            aPressed = true;
            break;
        case "D":
        case "d":
            if(!dPressed && GAME_STATE == STATES.STEADY) {
                // Init next level
                nextLevel();
            }
            dPressed = true;
            break;
    }
}
function keyUpHandler(e) {
    switch(e.key) {
        case "Right":
        case "ArrowRight":
            rightPressed = false;
            break;
        case "Left":
        case "ArrowLeft":
            leftPressed = false;
            break;
        case " ":
            spacePressed = false;
            break;
        case "Z":
        case "z":
            fastArrowKeys = false;
            break;
        case "X":
        case "x":
            xPressed = false;
            break;
        case "T":
        case "t":
            tPressed = false;
            break;
        case "A":
        case "a":
            aPressed = false;
            break;
        case "D":
        case "d":
            dPressed = false;
            break;
    }
}
function mouseMoveHandler(e) {
    var relativeX = e.clientX - canvas.offsetLeft;
    if(GAME_STATE == STATES.ALIVE || GAME_STATE == STATES.STEADY) {
        if(gamePaddle.width/2 <= relativeX && relativeX <= canvas.width - gamePaddle.width/2) {
            gamePaddle.x = relativeX - gamePaddle.width/2;
            if(GAME_STATE == STATES.STEADY) {
                gameBall.x = relativeX;
            }
        }
        else if(relativeX <= gamePaddle.width/2) {
            gamePaddle.x = 0;
            if(GAME_STATE == STATES.STEADY) {
                gameBall.x = gamePaddle.width/2;
            }
        }
        else if(canvas.width - gamePaddle.width/2 <= relativeX) {
            gamePaddle.x = canvas.width - gamePaddle.width;
            if(GAME_STATE == STATES.STEADY) {
                gameBall.x = canvas.width - gamePaddle.width/2;
            }
        }
    }
}
function clickHandler() {
    //console.log("Click handler fired!");
    if(GAME_STATE == STATES.STEADY) {
        steadyClicked = true;
    }
    // Resume audio if suspended (autoplay restrictions)
    checkAudio();
}


// ======================================================================================================================================
// Wall/collision methods
// ======================================================================================================================================
function brickCollision(br) {
    let strip_v = br.x <= gameBall.x && gameBall.x <= br.x + brickWidth;
    let strip_h = br.y <= gameBall.y && gameBall.y <= br.y + brickHeight;
    let collided = false;
    // Check edges
    if(strip_v) {
        // Moving downwards
        if(gameBall.dy > 0 && br.y <= gameBall.y + gameBall.radius && gameBall.y + gameBall.radius <= br.y + brickHeight) {
            gameBall.dy = -gameBall.dy;
            collided = true;
        }
        // Moving upwards
        else if(gameBall.dy < 0 && br.y <= gameBall.y - gameBall.radius && gameBall.y - gameBall.radius <= br.y + brickHeight) {
            gameBall.dy = -gameBall.dy;
            collided = true;
        }
    }
    else if(strip_h) {
        // Moving to the right
        if(gameBall.dx > 0 && br.x <= gameBall.x + gameBall.radius && gameBall.x + gameBall.radius <= br.x + brickWidth) {
            gameBall.dx = -gameBall.dx;
            collided = true;
        }
        // Moving to the left
        else if(gameBall.dx < 0 && br.x <= gameBall.x - gameBall.radius && gameBall.x - gameBall.radius <= br.x + brickWidth) {
            gameBall.dx = -gameBall.dx;
            collided = true;
        }
    }
    // Check corner regions
    else {
        // Find closest corner to ball center
        let corner;
        let min_d = canvas.width;
        for(pt of [{x: br.x, y: br.y}, {x: br.x + brickWidth, y: br.y}, {x: br.x, y: br.y + brickHeight}, {x: br.x + brickWidth, y: br.y + brickHeight}]) {
            let this_d = Math.sqrt(Math.pow(gameBall.x - pt.x, 2) + Math.pow(gameBall.y - pt.y, 2));
            if(this_d < min_d) {
                min_d = this_d;
                corner = pt;
            }
        }
        // Check for collision
        if(min_d < gameBall.radius) {
            let dist_x = gameBall.x - corner.x;
            let dist_y = gameBall.y - corner.y;
            let k = - (2*gameBall.dx*dist_x + 2*gameBall.dy*dist_y) / (Math.pow(dist_x, 2) + Math.pow(dist_y, 2));
            gameBall.dx += k*dist_x;
            gameBall.dy += k*dist_y;
            collided = true; 
        }
    }
    return collided;
}

function collisionDetection() {
    // Handles brick collisions
    for(var c=0; c<brickColumnCount; c++) {
        for(var r=0; r<brickRowCount; r++) {
            let b = bricks[c][r];
            if(b.status == 1 && brickCollision(b)) {
                b.status--;
                // Add point, speed up ball every 7 pts (by default)
                score++;
                if(score%5 == 0) {
                    gameBall.speedUp(1.05);
                }
                // Play sound effect
                playFromName("bounce_high");
            }
        }
    }
}
function wallDetection() {
    // Handles wall collisions
    if(gameBall.x + gameBall.dx > canvas.width-gameBall.radius || gameBall.x + gameBall.dx < gameBall.radius) {
        gameBall.dx = -gameBall.dx;
        playFromName("bounce_low");
    }
    if(gameBall.y + gameBall.dy < gameBall.radius) {
        gameBall.dy = -gameBall.dy;
        playFromName("bounce_low");
    }
    // Check if ball is bouncing from pad, or lost
    else if(gameBall.dy > 0 && gameBall.y + gameBall.dy > canvas.height-gameBall.radius-gamePaddle.hover-gamePaddle.height) {
    	if(gameBall.y <= canvas.height-gameBall.radius-gamePaddle.hover && gamePaddle.x < gameBall.x && gameBall.x < gamePaddle.x + gamePaddle.width) {
            gameBall.dy = -gameBall.dy;
            playFromName("bounce_low");
        }
        else if(gameBall.y - gameBall.radius > canvas.height) {
        	// Update highscore, draw GAME OVER
            if(score > highScore) {
        		highScore = score;
            }
            GAME_STATE = STATES.GAMEOVER;
            //console.log("Changed GAME_STATE to GAMEOVER");
        }
    }
}


// ======================================================================================================================================
// Draw methods
// ======================================================================================================================================
function fillRoundRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

function drawBricks() {
    for(var c=0; c<brickColumnCount; c++) {
        for(var r=0; r<brickRowCount; r++) {
            let b = bricks[c][r];
        	if(b.status == 1) {
            	ctx.beginPath();
        		ctx.rect(b.x, b.y, brickWidth, brickHeight);
        		ctx.fillStyle = "#005fcc"; // Default is #0095DD;
                ctx.fill();
                if(strokeBrick) {
                    ctx.strokeStyle = "#006be8";
                    ctx.stroke();
                }
          		ctx.closePath();
            }
        }
    }
}

function drawScore() {
	ctx.font = "16px " + GLOBAL_FONT;
    ctx.fillStyle = "#446673";
    ctx.fillText("score: " + score, 8, 20);
}

function drawLevelName(name) {
	ctx.font = "Bold 16px " + GLOBAL_FONT;
    ctx.fillStyle = "#40414a";
    ctx.fillText(name, canvas.width/2 - ctx.measureText(name).width/2, 20);
}

function drawFPS(frame_ms) {
    let fps_str = `[${Math.trunc(1000.0/frame_ms)} FPS]`;
    if(1000.0/frame_ms >= 1000) {
        fps_str = "[1000+ FPS]";
    }
	ctx.font = "Bold 16px " + GLOBAL_FONT;
    ctx.fillStyle = "#002c5e";
    ctx.fillText(fps_str, 3*canvas.width/4 - ctx.measureText(fps_str).width/2, 20);
}

// --- Below are state draws (more general, use the above) and text draws

// Encompasses ball, paddle, bricks, score
function drawGameElements() {
    drawBricks();
    gameBall.draw();
    gamePaddle.draw();
    drawScore();
    drawLevelName(LEVELS[CURRENT_LEVEL].name);
}

function drawMuted() {
    ctx.font = "16px " + GLOBAL_FONT;
    let thisWidth = ctx.measureText("[muted]").width;
    ctx.fillStyle = "#446673";
    ctx.fillText("[muted]", canvas.width - thisWidth - 8, 20);
}

function drawGameOver() {
    ctx.font = "Bold 40px " + GLOBAL_FONT;
    var textDims = ctx.measureText("game over");

    ctx.fillStyle = "#40414a";
    ctx.globalAlpha = 0.9;
    fillRoundRect(canvas.width/2 - textDims.width/2 - 10, canvas.height/2 - 25, textDims.width + 20, 100, 10);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#ffffff";
    ctx.fillText("game over", canvas.width/2 - textDims.width/2, canvas.height/2 + 15);
    
    ctx.font = "20px " + GLOBAL_FONT;
    textDims = ctx.measureText("final score: " + score);
    ctx.fillText("final score: " + score, canvas.width/2 - textDims.width/2, canvas.height/2 + 40);
    textDims = ctx.measureText("highscore: " + score);
    ctx.fillText("highscore: " + highScore, canvas.width/2 - textDims.width/2, canvas.height/2 + 60);

    ctx.font = "Bold 18px " + GLOBAL_FONT;
    ctx.fillStyle = "#000000";
    var smallWidth = ctx.measureText("press [SPACE] to play again").width;
    ctx.fillText("press [SPACE] to play again", canvas.width/2 - smallWidth/2, canvas.height/2 + 225);
    var smallerWidth = ctx.measureText("press [X] to return to main menu").width;
    ctx.fillText("press [X] to return to main menu", canvas.width/2 - smallerWidth/2, canvas.height/2 + 255);
}

function drawWelcome() {
    ctx.font = "Bold 80px " + GLOBAL_FONT;
    bigWidth = ctx.measureText("webkanoid").width;

    // Rounded rectangle
    ctx.fillStyle = "#0095DD";
    fillRoundRect(canvas.width/2 - bigWidth/2 - 15, canvas.height/2 - 70, bigWidth + 30, 95, 10);

    // Shadows
    ctx.fillStyle = "#000000";
    ctx.fillText("webkanoid", canvas.width/2 - bigWidth/2 + 4, canvas.height/2 + 4);
    // Foretext
    ctx.fillStyle = "#446673";
    ctx.fillText("webkanoid", canvas.width/2 - bigWidth/2, canvas.height/2);

    // Small text
    ctx.font = "Bold 18px " + GLOBAL_FONT;
    ctx.fillStyle = "#000000";
    smallWidth = ctx.measureText("press [SPACE] to begin!").width;
    ctx.fillText("press [SPACE] to begin!", canvas.width/2 - smallWidth/2, canvas.height/2 + 70);
    smallerWidth = ctx.measureText("press [M] to toggle sound").width;
    ctx.fillText("press [M] to toggle sound", canvas.width/2 - smallerWidth/2, canvas.height/2 + 100);
}

function drawSteady() {
    ctx.font = "Bold 18px " + GLOBAL_FONT;
    ctx.fillStyle = "#000000";
    var smallWidth = ctx.measureText("move with mouse or arrow keys (hold [Z] to boost key movement)").width;
    ctx.fillText("move with mouse or arrow keys (hold [Z] to boost key movement)", canvas.width/2 - smallWidth/2, canvas.height/2 + 225);
    var smallerWidth = ctx.measureText("click or press [SPACE] to release the ball!").width;
    ctx.fillText("click or press [SPACE] to release the ball!", canvas.width/2 - smallerWidth/2, canvas.height/2 + 255);
}


// ======================================================================================================================================
// Tick updaters
// ======================================================================================================================================
function steadyTick() {
    // Move paddle and accelerate if Z is pressed
    if(rightPressed && gamePaddle.x < canvas.width-gamePaddle.width) {
        gamePaddle.x += 7;
    }
    else if(leftPressed && gamePaddle.x > 0) {
        gamePaddle.x -= 7;
    }
}

function aliveTick() {
    // Collision detection
    collisionDetection();
    
    // Wall detection
    wallDetection();

    // Update paddle pos
    if(rightPressed && gamePaddle.x < canvas.width-gamePaddle.width) {
        gamePaddle.x += 7;
        if(fastArrowKeys) {
            gamePaddle.x += 5;
        }
    }
    else if(leftPressed && gamePaddle.x > 0) {
        gamePaddle.x -= 7;
        if(fastArrowKeys) {
            gamePaddle.x -= 5;
        }
    }
    // Update ball pos
    gameBall.x += gameBall.dx;
    gameBall.y += gameBall.dy;
}

function gameOverTick() {
    // Game over tick, check for new game
    drawGameOver();
    if(spacePressed) {
        GAME_STATE = STATES.STEADY;
        //console.log("Changed GAME_STATE to STEADY");
        initGame();
    } else if(xPressed) {
        GAME_STATE = STATES.WELCOME;
        //console.log("Changed GAME_STATE to WELCOME");
        playFromName("back_to_menu");
    }
}

function welcomeTick() {
    if(spacePressed) {
        GAME_STATE = STATES.STEADY;
        //console.log("Changed GAME_STATE to STEADY");
        playFromName("welcome");
        initGame();
    }
}

function steadyTick() {
    // Move paddle while steady
    if(rightPressed && gamePaddle.x < canvas.width-gamePaddle.width) {
        gamePaddle.x += 7;
        gameBall.x += 7;
        if(fastArrowKeys) {
            gamePaddle.x += 5;
            gameBall.x += 5;
        }
    }
    else if(leftPressed && gamePaddle.x > 0) {
        gamePaddle.x -= 7;
        gameBall.x -= 7;
        if(fastArrowKeys) {
            gamePaddle.x -= 5;
            gameBall.x -= 5;
        }
    }
    // Check for/change state to alive
    if(!spacePressed) {
        steadyCanStart = true;
    }
    if(steadyClicked || (steadyCanStart && spacePressed)) {
        steadyCanStart = false;
        steadyClicked = false;
        GAME_STATE = STATES.ALIVE;
        //console.log("Changed GAME_STATE to ALIVE");
        gameBall.initVel(3, -3);
    }
}


// ======================================================================================================================================
// Main draw loop
// ======================================================================================================================================
function drawLoop() {
    // (start frame timer)
    frameS = (new Date()).getTime();
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw
    switch(GAME_STATE) {
        case STATES.WELCOME:
            drawWelcome();
            break;
        case STATES.STEADY:
            drawGameElements();
            drawSteady();
            break;
        case STATES.ALIVE:
            drawGameElements();
            break;
        case STATES.GAMEOVER:
            drawGameElements();
            drawGameOver();
            break;
    }
    if(MUTED) {
        drawMuted();
    }

    // Tick
    switch(GAME_STATE) {
        case STATES.WELCOME:
            welcomeTick();
            break;
        case STATES.STEADY:
            steadyTick();
            break;
        case STATES.ALIVE:
            aliveTick();
            break;
        case STATES.GAMEOVER:
            gameOverTick();
            break;
    }

    // (draw FPS)
    let frame_len = (new Date()).getTime() - frameS;
    if(frame_len > 16.667) {
        console.log("FPS dropped below 60!");
    }
    if(showFPS) {
        drawFPS(frame_len);
    }

    // Loop
    requestAnimationFrame(drawLoop);
}


// ======================================================================================================================================
// Startup code
// ======================================================================================================================================
function masterStart() {
    // Check if main font finished loading
    if(document.fonts.check("12px " + GLOBAL_FONT)) {
        console.log("Main font loaded on time!");
    }
    else {
        console.log("Main font failed to load on time, using Courier.");
        GLOBAL_FONT = "Courier";
    }
    // Startup methods
    setupAudioContext();
    GAME_STATE = STATES.WELCOME;
    drawLoop();
}

// Start when the main font is loaded
document.fonts.onloadingdone = masterStart;
// Start loading levels
LEVELS = new Array(AVAILABLE_LEVELS);
loadAllLevels();
// Draw ghost text to force main font to load
ctx.font = "24px " + GLOBAL_FONT;
ctx.fillStyle = "#eeeeee";
ctx.fillText(".", 0, 0);
