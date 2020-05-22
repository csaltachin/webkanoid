// Webkanoid

var canvas = document.getElementById("gameCanvas");
var ctx = canvas.getContext("2d");

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

var ballRadius = 8;
var x = canvas.width/2;
var y = canvas.height-30;
var dx = 3;
var dy = -3;

var paddleHeight = 10;
var paddleWidth = 75;
var paddleHover = 10;
var paddleX = (canvas.width-paddleWidth)/2;
var rightPressed = false;
var leftPressed = false;
var spacePressed = false;

var bricks = [];
var brickRowCount = 14;
var brickColumnCount = 14;
var brickWidth = 75;
var brickHeight = 20;
var brickPadding = 10;
var brickOffsetTop = 30;
var brickOffsetLeft = 30;

var score = 0;
var highScore = 0;
var alive = true;

// Add listeners
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
document.addEventListener("mousemove", mouseMoveHandler, false);

/*
 * Initializers
 */
function initBall() {
    var b = new Ball(8);
    b.init(canvas.width/2, canvas.height-30, 3, -3);
    return b;
}

function initPaddle() {
    paddleX = (canvas.width-paddleWidth)/2;
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
    initPaddle();
    gameBall = initBall();
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
        if(paddleWidth/2 <= relativeX && relativeX <= canvas.width - paddleWidth/2) {
    		paddleX = relativeX - paddleWidth/2;
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
            	}
            }
        }
    }
}

function wallDetection() {
    // Handles wall collisions
    if(gameBall.x + gameBall.dx > canvas.width-ballRadius || gameBall.x + gameBall.dx < ballRadius) {
        gameBall.dx = -gameBall.dx;
    }
    if(gameBall.y + gameBall.dy < ballRadius) {
        gameBall.dy = -gameBall.dy;
    }
    else if(gameBall.y + gameBall.dy > canvas.height-ballRadius-paddleHover-paddleHeight) {
    		if(gameBall.y <= canvas.height-ballRadius-paddleHover && paddleX < gameBall.x && gameBall.x < paddleX + paddleWidth) {
        		gameBall.dy = -gameBall.dy;
        }
        else if(gameBall.y + gameBall.dy > canvas.height-ballRadius) {
        	// Update highscore, draw GAME OVER
            if(score > highScore) {
            		highScore = score;
            }
            // drawGameOver();
            alive = false;
        }
    }
}


/*
 * Draw methods
 */
function drawBall() {
    ctx.beginPath();
    ctx.arc(x, y, ballRadius, 0, Math.PI*2);
    ctx.fillStyle = "#0095DD";
    ctx.fill();
    ctx.closePath();
}

function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddleX, canvas.height-paddleHeight-paddleHover, paddleWidth, paddleHeight);
    ctx.fillStyle = "#40414a";
    ctx.fill();
    ctx.closePath();
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
    if(rightPressed && paddleX < canvas.width-paddleWidth) {
        paddleX += 7;
    }
    else if(leftPressed && paddleX > 0) {
        paddleX -= 7;
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
 * Main draw()
 */
function drawLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBricks();
    gameBall.draw();
    drawPaddle();
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
initGame();
console.log("All game elements initialized!");
drawLoop();