import { Blog } from '../models/Blog.js';
import { getUserContext } from '../middleware/auth.js';

export async function listBlogs(req, res) {
  const { role, username } = getUserContext(req);
  try {
    let query = {};
    if (role === 'mentor' && username) {
      query = { announcedBy: username };
    }
    const list = await Blog.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch blogs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createBlog(req, res) {
  const { username } = getUserContext(req);
  const { title, label, copy, content, bannerUrl } = req.body;
  try {
    const item = await Blog.create({
      title,
      label,
      copy,
      content,
      bannerUrl: bannerUrl || '',
      announcedBy: username
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateBlog(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const { title, label, copy, content, bannerUrl } = req.body;
  try {
    const item = await Blog.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Blog not found' });
    }
    if (role === 'mentor' && item.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot edit another user\'s blog' });
    }

    item.title = title ?? item.title;
    item.label = label ?? item.label;
    item.copy = copy ?? item.copy;
    item.content = content ?? item.content;
    item.bannerUrl = bannerUrl ?? item.bannerUrl;

    await item.save();
    res.json(item);
  } catch (error) {
    console.error('Update blog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteBlog(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  try {
    const item = await Blog.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Blog not found' });
    }
    if (role === 'mentor' && item.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot delete another user\'s blog' });
    }
    await Blog.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete blog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
