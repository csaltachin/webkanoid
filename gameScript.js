// Webkanoid

var DIR = "file:///C:/Users/csalt/Documents/Code/Web%20stuff/webkanoid";
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
var brickOffsetLeft = 30;

class AudioFX extends Audio {
    constructor(src) {
        super(src);
    }
    clonePlay(volume) {
        if(typeof volume == "undefined") {
            volume = 0.5; // Default volume level for sound effects
        }
        var clone = this.cloneNode();
        clone.volume = volume;
        clone.play();
    }
}

var SOUND_FX = {
    // Effects
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
    }
}
var DEFAULT_VOL = 0.5;

var score = 0;
var highScore = 0;
var alive = true;

var rightPressed = false;
var leftPressed = false;
var spacePressed = false;

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
    init(x, y, dx, dy) {
        this.x = x;
        this.y = y;
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


/*
 * Initializers
 */
function initBall() {
    // Using default dimensions
    var b = new Ball(8);
    b.init(canvas.width/2, canvas.height-30, 3, -3);
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


/*
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
}
function mouseMoveHandler(e) {
    var relativeX = e.clientX - canvas.offsetLeft;
    if(alive) {
        if(gamePaddle.width/2 <= relativeX && relativeX <= canvas.width - gamePaddle.width/2) {
    		gamePaddle.x = relativeX - gamePaddle.width/2;
        }
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
                    // Add point, speed up ball every 20 pts (by default)
                    score++;
                    if(score%10 == 0) {
                        gameBall.speedUp(1.05);
                    }
                    // Play sound effect
                    SOUND_FX.bounce_high.clonePlay();
            	}
            }
        }
    }
}

function wallDetection() {
    // Handles wall collisions
    if(gameBall.x + gameBall.dx > canvas.width-gameBall.radius || gameBall.x + gameBall.dx < gameBall.radius) {
        gameBall.dx = -gameBall.dx;
        SOUND_FX.bounce_low.clonePlay();
    }
    if(gameBall.y + gameBall.dy < gameBall.radius) {
        gameBall.dy = -gameBall.dy;
        SOUND_FX.bounce_low.clonePlay();
    }
    else if(gameBall.y + gameBall.dy > canvas.height-gameBall.radius-gamePaddle.hover-gamePaddle.height) {
    		if(gameBall.y <= canvas.height-gameBall.radius-gamePaddle.hover && gamePaddle.x < gameBall.x && gameBall.x < gamePaddle.x + gamePaddle.width) {
                gameBall.dy = -gameBall.dy;
                SOUND_FX.bounce_low.clonePlay();
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
    ctx.fillText("Score: " + score, 8, 20)
}

function drawGameOver() {
	ctx.font = "Bold 40px Consolas";
    ctx.fillStyle = "#446673";
    var textDims = ctx.measureText("GAME OVER")
    ctx.fillText("GAME OVER", canvas.width/2 - textDims.width/2, canvas.height/2 + 20);
    
    ctx.font = "20px Consolas";
    var textDims = ctx.measureText("Final score: " + score);
    ctx.fillText("Final score: " + score, canvas.width/2 - textDims.width/2, canvas.height/2 + 40);
    var textDims = ctx.measureText("Highscore: " + score);
    ctx.fillText("Highscore: " + highScore, canvas.width/2 - textDims.width/2, canvas.height/2 + 60);
}


/*
 * Tick updaters
 */
function aliveTick() {
    // Collision detection
    collisionDetection();
    
    // Wall detection
    wallDetection();

    // Update paddle pos
    if(rightPressed && gamePaddle.x < canvas.width-gamePaddle.width) {
        gamePaddle.x += 7;
    }
    else if(leftPressed && gamePaddle.x > 0) {
        gamePaddle.x -= 7;
    }
    // Update ball pos
    gameBall.x += gameBall.dx;
    gameBall.y += gameBall.dy;
}

function gameOverTick() {
    // Game over tick, check for new game
    drawGameOver();
    if(spacePressed) {
        alive = true;
        initGame();
    }
}

/*
 * Main draw loop
 */
function drawLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBricks();
    gameBall.draw();
    gamePaddle.draw();
    drawScore();
    
    if(alive) {
        aliveTick();
    }
    else {
        gameOverTick();
    }
    
    requestAnimationFrame(drawLoop);
}


// Start first game (TODO: Welcome state/screen?)
SOUND_FX.load_all();
initGame();
drawLoop();