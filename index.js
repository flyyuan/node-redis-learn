const Koa = require('koa');
const Router = require('koa-router');
const Redis = require('ioredis');

const app = new Koa();
const router = new Router();
const redisClient = new Redis({
    host: '127.0.0.1',
    port: 6379
});

redisClient.on('connect', function() {
    console.log('Redis client connected');
});

redisClient.on('error', function(err) {
    console.log('Redis client could not connect: ', err);
});

router.get('/', async (ctx, next) => {
    let count = await redisClient.incr('visit_count');
    ctx.body = `This page has been visited ${count} times`;
});

router.get('/setuser', async (ctx, next) => {
    await redisClient.set('user', 'John Doe');
    ctx.body = 'User set successfully';
});

router.get('/getuser', async (ctx, next) => {
    let user = await redisClient.get('user');
    ctx.body = `User: ${user}`;
});

router.get('/setuserinfo', async (ctx, next) => {
    await redisClient.hset('user_info', 'name', 'John Doe', 'age', '30', 'email', 'john.doe@example.com');
    ctx.body = 'User info set successfully';
});

router.get('/getuserinfo', async (ctx, next) => {
    let userInfo = await redisClient.hgetall('user_info');
    ctx.body = `User Info: ${JSON.stringify(userInfo)}`;
});

router.get('/addactivity', async (ctx, next) => {
    await redisClient.lpush('user_activities', 'Logged in', 'Posted a comment', 'Logged out');
    ctx.body = 'User activities added successfully';
});

router.get('/getactivities', async (ctx, next) => {
    let activities = await redisClient.lrange('user_activities', 0, -1);
    ctx.body = `User Activities: ${activities.join(', ')}`;
});

router.get('/addfriends/:username', async (ctx, next) => {
    const { username } = ctx.params;
    await redisClient.sadd(`user_friends:${username}`, 'Alice', 'Bob', 'Charlie');
    ctx.body = `Friends added for user ${username} successfully`;
});

router.get('/getfriends/:username', async (ctx, next) => {
    const { username } = ctx.params;
    let friends = await redisClient.smembers(`user_friends:${username}`);
    ctx.body = `Friends of ${username}: ${friends.join(', ')}`;
});


router.get('/addscores', async (ctx, next) => {
    await redisClient.zadd('user_scores', 100, 'Alice', 200, 'Bob', 150, 'Charlie');
    ctx.body = 'User scores added successfully';
});

router.get('/getscores', async (ctx, next) => {
    let scores = await redisClient.zrange('user_scores', 0, -1, 'WITHSCORES');
    ctx.body = `User Scores: ${JSON.stringify(scores)}`;
});

router.get('/publish/:message', async (ctx, next) => {
    const { message } = ctx.params;
    await redisClient.publish('news', message);
    ctx.body = `Message ${message} published to the 'news' channel successfully`;
});

// router.get('/transaction', async (ctx, next) => {
//     let pipeline = redisClient.pipeline();
//     pipeline.incr('visit_count');
//     pipeline.incr('visit_count');
//     let results = await pipeline.exec();
//     ctx.body = `The visit count is increased by 2, and now it is ${results[1][1]}`;
// });

router.get('/transaction', async (ctx, next) => {
    // let multi = redisClient.multi();
    // multi.incr('visit_count');
    // multi.incr('visit_count');
    // let results = await multi.exec();
    // ctx.body = `The visit count is increased by 2, and now it is ${results[1][1]}`;
    await redisClient.watch('visit_count');
    let visitCount = await redisClient.get('visit_count');
    let multi = redisClient.multi();
    multi.set('visit_count', parseInt(visitCount) + 1);
    let result = await multi.exec();
    if (result === null) {
        console.log('The visit_count was changed by others, transaction cancelled.');
    } else {
        console.log('The visit_count is increased by 1.');
    }
});


router.get('/transaction-fail', async (ctx, next) => {
    await redisClient.set('mykey', 'a string value');
    let pipeline = redisClient.pipeline();
    pipeline.incr('mykey');  // This will fail because 'mykey' is not an integer.
    pipeline.incr('visit_count');
    let results = await pipeline.exec();
    if (results[0][0]) {
        ctx.body = `Transaction failed: ${results[0][0].message}`;
    } else {
        ctx.body = `The visit count is increased by 1, and now it is ${results[1][1]}`;
    }
});

router.get('/set-stock', async (ctx, next) => {
    await redisClient.set('stock', 10);
    ctx.body = 'Stock set to 10';
});

router.get('/decrease-stock', async (ctx, next) => {
    await redisClient.watch('stock');
    let stock = await redisClient.get('stock');
    if (parseInt(stock) <= 0) {
        ctx.body = 'Stock is not enough, transaction cancelled.';
        return;
    }
    let multi = redisClient.multi();
    multi.decr('stock');
    let result = await multi.exec();
    if (result === null) {
        ctx.body = 'The stock was changed by others, transaction cancelled.';
    } else {
        ctx.body = 'The stock is decreased by 1.';
    }
});

router.get('/lua', async (ctx, next) => {
    let result = await redisClient.eval('return redis.call(\'incr\', KEYS[1])', 1, 'lua_count');
    ctx.body = `The count is ${result}`;
});

router.get('/pipeline', async (ctx, next) => {
    let pipeline = redisClient.pipeline();
    pipeline.incr('pipeline_count');
    pipeline.get('pipeline_count');
    let results = await pipeline.exec();
    ctx.body = `The count is ${results[1][1]}`;
});



app.use(router.routes()).use(router.allowedMethods());

app.listen(3000, () => {
    console.log('Server is running at http://localhost:3000');
});


const subscriber = new Redis({
    host: '127.0.0.1',
    port: 6379
});

subscriber.subscribe('news', function (err, count) {
    if (err) {
        console.error('Failed to subscribe: ', err);
    } else {
        console.log(`Subscribed to ${count} channel. Listening for updates on the 'news' channel.`);
    }
});

subscriber.on('message', function (channel, message) {
    console.log(`Received the following message from ${channel}: ${message}`);
});

subscriber.on('message', function (channel, message) {
    console.log(`Received the following message from ${channel}: ${message}`);
});
