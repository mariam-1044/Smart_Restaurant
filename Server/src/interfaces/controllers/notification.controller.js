const notificationService = require('../../application/services/notification.service');

exports.list = async (req, res) => {
  try {
    const { before, limit } = req.query;
    const data = await notificationService.listForRole(req.user.role, { before, limit: Number(limit) || 20 });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.unreadCount = async (req, res) => {
  try {
    const count = await notificationService.unreadCountForRole(req.user.role);
    res.json({ success: true, data: { count } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const r = await notificationService.markRead(req.params.id, req.user.role);
    if (r.notFound)  return res.status(404).json({ success: false, message: 'notification_not_found' });
    if (r.forbidden) return res.status(403).json({ success: false, errorType: 'cross_role_forbidden', message: 'Notification is not visible to your role.' });
    res.json({ success: true, data: r.doc });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const r = await notificationService.markAllRead(req.user.role);
    res.json({ success: true, data: r });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};