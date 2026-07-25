module.exports = (req, res, next) => {
    const deviceId = req.headers['device-id'];
    const user = req.user;
    // allow admin to bypass device lock (so admin can log in from any device)
    // if (user && user.role === 'admin') return next();
    // if (user && user.lockedDeviceId && user.lockedDeviceId !== deviceId) {
    //     return res.status(403).json({ message: 'Device not authorized' });
    // }
    next();
};
