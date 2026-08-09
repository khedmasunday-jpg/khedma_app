const express = require('express');
const router = express.Router();
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const RssLink = require('../models/RssLink');
const User = require('../models/User');

// Create an RSS Link (Admin only)
router.post('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { title, url, allowedRoles, allowedUsers } = req.body;
    const newLink = new RssLink({ title, url, allowedRoles, allowedUsers });
    await newLink.save();
    res.status(201).json(newLink);
  } catch (error) {
    console.error('Create RSS error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// Get RSS Links based on user role and id
router.get('/', verifyToken, async (req, res) => {
  try {
    const { role, id } = req.user;
    let query = {};
    
    if (role === 'admin' || role === 'principal') {
      // Admins and Principals see all links
      query = {};
    } else {
      // Others see links that allow their role, or specifically allow their user ID
      // Or if a link allows everyone (empty roles and empty users) - assuming an empty link is public to all staff
      query = {
        $or: [
          { allowedRoles: role },
          { allowedUsers: id },
          { $and: [
              { allowedRoles: { $size: 0 } }, 
              { allowedUsers: { $size: 0 } }
          ]}
        ]
      };
    }
    
    const links = await RssLink.find(query).sort({ createdAt: -1 });
    res.json(links);
  } catch (error) {
    console.error('Fetch RSS error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// Update an RSS Link (Admin only)
router.put('/:id', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { title, url, allowedRoles, allowedUsers } = req.body;
    const link = await RssLink.findByIdAndUpdate(
      req.params.id, 
      { title, url, allowedRoles, allowedUsers },
      { new: true }
    );
    if (!link) {
      return res.status(404).json({ msg: 'Link not found' });
    }
    res.json(link);
  } catch (error) {
    console.error('Update RSS error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// Delete an RSS Link (Admin only)
router.delete('/:id', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const link = await RssLink.findByIdAndDelete(req.params.id);
    if (!link) {
      return res.status(404).json({ msg: 'Link not found' });
    }
    res.json({ msg: 'Link deleted' });
  } catch (error) {
    console.error('Delete RSS error:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

module.exports = router;
