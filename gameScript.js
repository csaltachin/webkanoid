//
// 
// webkanoid
// by Carlos Solano | csaltachin@gmail.com | repository at https://github.com/csaltachin/webkanoid
// -----------------------------------------------------------------------------------------------
// A simple Arkanoid/Breakout-style game, in pure JavaScript. Uses the Canvas API to draw graphics
// in a 2D context, as well as the AudioContext interface for buffered sound effects. These are
// obtained via XHR.
// 
//


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


//
// Audio
//
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCTX = new AudioContext();
var DEFAULT_VOL = 0.5;
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


//
// Game elements
//
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


//
// Score, states
//
var score = 0;
var highScore = 0;
var fastArrowKeys = false;

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

/*
 * Class definitions for Ball, Paddle
 */
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


//
// Initializer methods
//
function initBall() {
    // Using default dimensions
    var b = new Ball(8);
    b.initPos(canvas.width/2, canvas.height-30);
    return b;
}
function initPaddle() {
    // Using default dimensions
    var p = new Paddle(75, 10, 15);
    p.init();
    return p;
}
function initBricks() {
    for(var c=0; c<brickColumnCount; c++) {
        bricks[c] = [];
        for(var r=0; r<brickRowCount; r++) {
            bricks[c][r] = { x: 0, y: 0, status: 1 };
        }
    }
}
function initGame() {
    initBricks();
    gameBall = initBall();
    gamePaddle = initPaddle();
    score = 0;
}


//
// Add key/mouse listeners
//
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
document.addEventListener("mousemove", mouseMoveHandler, false);
canvas.onclick = clickHandler;


//
// Handler methods
//
function keyDownHandler(e) {
    if(e.key == "Right" || e.key == "ArrowRight") {
        rightPressed = true;
    }
    else if(e.key == "Left" || e.key == "ArrowLeft") {
        leftPressed = true;
    }
    else if(e.key == " ") {
        spacePressed = true;
    }
    else if(e.key == "M" || e.key == "m") {
        MUTED = !MUTED;
    }
    else if(e.key == "Z" || e.key == "z") {
        fastArrowKeys = true;
    }
    else if(e.key == "X" || e.key == "x") {
        xPressed = true;
    }
    else if(e.key == "T" || e.key == "t") {
        if(!tPressed && audioCTX.state != "suspended") {
            playFromBuffer(SOUND_BUFFERS.climb);
        }
        tPressed = true;
    }
    
    // Check for resuming audioCTX (because of autoplay restrictions)
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
function keyUpHandler(e) {
    if(e.key == "Right" || e.key == "ArrowRight") {
        rightPressed = false;
    }
    else if(e.key == "Left" || e.key == "ArrowLeft") {
        leftPressed = false;
    }
    else if(e.key == " ") {
        spacePressed = false;
    }
    else if(e.key == "Z" || e.key == "z") {
        fastArrowKeys = false;
    }
    else if(e.key == "X" || e.key == "x") {
        xPressed = false;
    }
    else if(e.key == "T" || e.key == "t") {
        tPressed = false;
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
    }
}
function clickHandler() {
    //console.log("Click handler fired!");
    if(GAME_STATE == STATES.STEADY) {
        steadyClicked = true;
    }
}


//
// Wall/collision methods
//
function collisionDetection() {
    // Handles brick collisions
    for(var c=0; c<brickColumnCount; c++) {
        for(var r=0; r<brickRowCount; r++) {
            var b = bricks[c][r];
            if(b.status == 1) {
            	if(gameBall.x > b.x && gameBall.x < b.x+brickWidth && gameBall.y > b.y && gameBall.y < b.y+brickHeight) {
            		gameBall.dy = -gameBall.dy;
                    b.status = 0;
                    // Add point, speed up ball every 7 pts (by default)
                    score++;
                    if(score%7 == 0) {
                        gameBall.speedUp(1.03);
                    }
                    // Play sound effect
                    playFromName("bounce_high");
            	}
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
    else if(gameBall.y + gameBall.dy > canvas.height-gameBall.radius-gamePaddle.hover-gamePaddle.height) {
    	if(gameBall.y <= canvas.height-gameBall.radius-gamePaddle.hover && gamePaddle.x < gameBall.x && gameBall.x < gamePaddle.x + gamePaddle.width) {
            gameBall.dy = -gameBall.dy;
            playFromName("bounce_low");
        }
        else if(gameBall.y + gameBall.dy > canvas.height-gameBall.radius) {
        	// Update highscore, draw GAME OVER
            if(score > highScore) {
        		highScore = score;
            }
            GAME_STATE = STATES.GAMEOVER;
            //console.log("Changed GAME_STATE to GAMEOVER");
        }
    }
}


//
// Draw methods
//
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
        	if(bricks[c][r].status == 1) {
        		var brickX = (c*(brickWidth+brickPadding))+brickOffsetLeft;
        		var brickY = (r*(brickHeight+brickPadding))+brickOffsetTop;
        		bricks[c][r].x = brickX;
            	bricks[c][r].y = brickY;
            	ctx.beginPath();
        		ctx.rect(brickX, brickY, brickWidth, brickHeight);
        		ctx.fillStyle = "#005fcc"; // Default is #0095DD;
        		ctx.fill();
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

// Encompasses ball, paddle, bricks, score
function drawGameElements() {
    drawBricks();
    gameBall.draw();
    gamePaddle.draw();
    drawScore();
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


//
// Tick updaters
//
function steadyTick() {
    // Move paddle and
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


/*
 * Main draw loop
 */
function drawLoop() {
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

    // Loop
    requestAnimationFrame(drawLoop);
}


//
// Startup code
//
function masterStart() {
    // Check if main font finished loading
    if(document.fonts.check("12px " + GLOBAL_FONT)) {
        console.log("Main font loaded on time!");
    }
    else {
        console.log("Main font failed to load on time.");
    }
    setupAudioContext();
    GAME_STATE = STATES.WELCOME;
    drawLoop();
}

// Start when the main font is loaded
document.fonts.onloadingdone = masterStart;
// Draw ghost text to force main font to load
ctx.font = "24px " + GLOBAL_FONT;
ctx.fillStyle = "#eeeeee";
ctx.fillText(".", 0, 0);
