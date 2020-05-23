// Webkanoid

var DIR = "file:///C:/Users/csalt/Documents/Code/Web%20stuff/webkanoid"; // Replace with the directory containing this file
var canvas = document.getElementById("gameCanvas");
var ctx = canvas.getContext("2d");

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

var DEFAULT_VOL = 0.5;
var CLONE_FX = false; // If true, use clonePlay over rewindPlay (buggy for now)

class AudioFX extends Audio {
    constructor(src) {
        super(src);
    }
    clonePlay(volume) {
        if(!muted) {
            if(typeof volume == "undefined") {
                volume = DEFAULT_VOL; // Default volume level for sound effects
            }
            var clone = this.cloneNode();
            clone.volume = volume;
            clone.play();
        }
    }
    rewindPlay(volume) {
        if(!muted) {
            if(typeof volume == "undefined") {
                volume = DEFAULT_VOL; // Default volume level for sound effects
            }
            this.volume = volume;
            this.currentTime = 0;
            this.play();
        }
    }
    smartPlay() {
        if(CLONE_FX) {
            this.clonePlay();
        }
        else {
            this.rewindPlay();
        }
    }
}

var SOUND_FX = {
    // Effects
    welcome: new AudioFX(DIR + "/fx/welcome.ogg"),
    back_to_menu: new AudioFX(DIR + "/fx/back_to_menu.ogg"),
    bounce_low: new AudioFX(DIR + "/fx/bounce_low.ogg"),
    bounce_high: new AudioFX(DIR + "/fx/bounce_high.ogg"),
    // Load method
    load_all: function() {
        for(const effect in this) {
            if(effect == "load_all") {
                continue;
            }
            this[effect].preload = "auto";
            this[effect].load();
        }
        console.log("All audio effects loaded!");
    }
}

var score = 0;
var highScore = 0;
var fastArrowKeys = false;

var alive = false;
var welcome = true;
var muted = false;
var steady = false;
var steadyCanStart = false;
var steadyClicked = false;

var rightPressed = false;
var leftPressed = false;
var spacePressed = false;
var xPressed = false;

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


/*
 * Add key/mouse listeners
*/
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
document.addEventListener("mousemove", mouseMoveHandler, false);
canvas.onclick = clickHandler;


/**
 * Initializer methods
 */
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


/**
 * Handler methods
 */
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
        muted = !muted;
    }
    else if(e.key == "Z" || e.key == "z") {
        fastArrowKeys = true;
    }
    else if(e.key == "X" || e.key == "x") {
        xPressed = true;
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
}
function mouseMoveHandler(e) {
    var relativeX = e.clientX - canvas.offsetLeft;
    if(alive || steady) {
        if(gamePaddle.width/2 <= relativeX && relativeX <= canvas.width - gamePaddle.width/2) {
            gamePaddle.x = relativeX - gamePaddle.width/2;
            if(!alive) {
                gameBall.x = relativeX;
            }
        }
    }
}
function clickHandler() {
    //console.log("Click handler fired!");
    if(steady) {
        steadyClicked = true;
    }
}

/*
 * Wall/collision methods
 */
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
                    SOUND_FX.bounce_high.smartPlay()
            	}
            }
        }
    }
}

function wallDetection() {
    // Handles wall collisions
    if(gameBall.x + gameBall.dx > canvas.width-gameBall.radius || gameBall.x + gameBall.dx < gameBall.radius) {
        gameBall.dx = -gameBall.dx;
        SOUND_FX.bounce_low.smartPlay();
    }
    if(gameBall.y + gameBall.dy < gameBall.radius) {
        gameBall.dy = -gameBall.dy;
        SOUND_FX.bounce_low.smartPlay();
    }
    else if(gameBall.y + gameBall.dy > canvas.height-gameBall.radius-gamePaddle.hover-gamePaddle.height) {
    	if(gameBall.y <= canvas.height-gameBall.radius-gamePaddle.hover && gamePaddle.x < gameBall.x && gameBall.x < gamePaddle.x + gamePaddle.width) {
            gameBall.dy = -gameBall.dy;
            SOUND_FX.bounce_low.smartPlay();
        }
        else if(gameBall.y + gameBall.dy > canvas.height-gameBall.radius) {
        	// Update highscore, draw GAME OVER
            if(score > highScore) {
        		highScore = score;
            }
            alive = false;
        }
    }
}


/*
 * Draw methods
 */
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
            		ctx.fillStyle = "#0095DD";
            		ctx.fill();
            		ctx.closePath();
            }
        }
    }
}

function drawScore() {
	ctx.font = "16px Consolas";
    ctx.fillStyle = "#446673";
    ctx.fillText("score: " + score, 8, 20);
}

function drawMuted() {
    ctx.font = "16px Consolas";
    var thisWidth = ctx.measureText("[muted]").width;
    ctx.fillStyle = "#446673";
    ctx.fillText("[muted]", canvas.width - thisWidth - 8, 20);
}

function drawGameOver() {
    ctx.font = "Bold 40px Consolas";
    var textDims = ctx.measureText("game over");

    ctx.fillStyle = "#40414a";
    ctx.globalAlpha = 0.9;
    fillRoundRect(canvas.width/2 - textDims.width/2 - 10, canvas.height/2 - 25, textDims.width + 20, 100, 10);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#ffffff";
    ctx.fillText("game over", canvas.width/2 - textDims.width/2, canvas.height/2 + 15);
    
    ctx.font = "20px Consolas";
    textDims = ctx.measureText("final score: " + score);
    ctx.fillText("final score: " + score, canvas.width/2 - textDims.width/2, canvas.height/2 + 40);
    textDims = ctx.measureText("highscore: " + score);
    ctx.fillText("highscore: " + highScore, canvas.width/2 - textDims.width/2, canvas.height/2 + 60);

    ctx.font = "Bold 18px Consolas"
    ctx.fillStyle = "#000000"
    var smallWidth = ctx.measureText("press [SPACE] to play again").width;
    ctx.fillText("press [SPACE] to play again", canvas.width/2 - smallWidth/2, canvas.height/2 + 225);
    var smallerWidth = ctx.measureText("press [X] to return to main menu").width;
    ctx.fillText("press [X] to return to main menu", canvas.width/2 - smallerWidth/2, canvas.height/2 + 255);
}

function drawWelcome() {
    ctx.font = "Bold 80px Consolas";
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
    ctx.font = "Bold 18px Consolas"
    ctx.fillStyle = "#000000"
    smallWidth = ctx.measureText("press [SPACE] to begin!").width;
    ctx.fillText("press [SPACE] to begin!", canvas.width/2 - smallWidth/2, canvas.height/2 + 70);
    smallerWidth = ctx.measureText("press [M] to toggle sound").width;
    ctx.fillText("press [M] to toggle sound", canvas.width/2 - smallerWidth/2, canvas.height/2 + 100);
}

function drawSteady() {
    ctx.font = "Bold 18px Consolas"
    ctx.fillStyle = "#000000"
    var smallWidth = ctx.measureText("move with mouse or arrow keys (hold [Z] to boost key movement)").width;
    ctx.fillText("move with mouse or arrow keys (hold [Z] to boost key movement)", canvas.width/2 - smallWidth/2, canvas.height/2 + 225);
    var smallerWidth = ctx.measureText("click or press [SPACE] to release the ball!").width;
    ctx.fillText("click or press [SPACE] to release the ball!", canvas.width/2 - smallerWidth/2, canvas.height/2 + 255);
}


/*
 * Tick updaters
 */
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
        steady = true;
        initGame();
    } else if(xPressed) {
        welcome = true;
        SOUND_FX.back_to_menu.clonePlay();
    }
}

function welcomeTick() {
    if(spacePressed) {
        welcome = false;
        steady = true;
        SOUND_FX.welcome.clonePlay();
        initGame();
    }
}


/*
 * Main draw loop
 */
function drawLoop() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw
    if(muted) {
        drawMuted();
    }
    if(welcome) {
        drawWelcome();
    }
    else {
        drawBricks();
        gameBall.draw();
        gamePaddle.draw();
        drawScore();
    }
    // Tick
    if(alive) {
        aliveTick();
    }
    else if(steady) {
        // Steady tick (TODO: Draw instructions/level select?)
        // Draw steady text
        drawSteady();
        // Move paddle w/ keys
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
        // Change state to alive
        if(!spacePressed) {
            steadyCanStart = true;
        }
        if(steadyClicked || (steadyCanStart && spacePressed)) {
            steady = false;
            steadyCanStart = false;
            steadyClicked = false;
            alive = true;
            gameBall.initVel(3, -3);
        }
    }
    else if(welcome) {
        welcomeTick();
    }
    else {
        gameOverTick();
    }
    // Loop
    requestAnimationFrame(drawLoop);
}


// Start first game (TODO: Welcome state/screen?)
SOUND_FX.load_all();
drawLoop();