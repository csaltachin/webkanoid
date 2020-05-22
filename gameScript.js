// Simple Breakout Game

var canvas = document.getElementById("gameCanvas");
var ctx = canvas.getContext("2d");
var ballRadius = 10;
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
    x = canvas.width/2;
    y = canvas.height-30;
    dx = 3;
    dy = -3;
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
    initBall();
    score = 0;
}

initGame();


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

function collisionDetection() {
    for(var c=0; c<brickColumnCount; c++) {
        for(var r=0; r<brickRowCount; r++) {
            var b = bricks[c][r];
            if(b.status == 1) {
            		if(x > b.x && x < b.x+brickWidth && y > b.y && y < b.y+brickHeight) {
                		dy = -dy;
                    b.status = 0;
                    // Add point, speed up ball
                    score++;
                    dx = dx*1.05;
                    dy = dy*1.05;
            		}
            }
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
    if(x + dx > canvas.width-ballRadius || x + dx < ballRadius) {
        dx = -dx;
    }
    if(y + dy < ballRadius) {
        dy = -dy;
    }
    else if(y + dy > canvas.height-ballRadius-paddleHover-paddleHeight) {
    		if(y <= canvas.height-ballRadius-paddleHover && paddleX < x && x < paddleX + paddleWidth) {
        		dy = -dy;
        }
        else if(y + dy > canvas.height-ballRadius) {
        	// Update highscore, draw GAME OVER
            if(score > highScore) {
            		highScore = score;
            }
            drawGameOver();
            alive = false;
        }
    }
    
    // Update paddle pos
    if(rightPressed && paddleX < canvas.width-paddleWidth) {
        paddleX += 7;
    }
    else if(leftPressed && paddleX > 0) {
        paddleX -= 7;
    }
    // Update ball pos
    x += dx;
    y += dy;
}

/*
 * Main draw()
 */
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBricks();
    drawBall();
    drawPaddle();
    drawScore();
    
    if(alive) {
        aliveTick();
    }
    else {
        // Game over tick, check for new game
        drawGameOver();
        if(spacePressed) {
            alive = true;
            initGame();
        }
    }
    
    requestAnimationFrame(draw)
}

draw()