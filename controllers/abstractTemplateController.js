import { AbstractTemplate } from '../models/AbstractTemplate.js';

export async function getAbstractTemplate(req, res) {
  try {
    const item = await AbstractTemplate.findOne().sort({ updatedAt: -1 });
    res.json(item || null);
  } catch (error) {
    console.error('Fetch abstract template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function saveAbstractTemplate(req, res) {
  const { fileUrl, fileName, title } = req.body;
  try {
    if (!fileUrl) {
      return res.status(400).json({ error: 'fileUrl is required' });
    }
    let item = await AbstractTemplate.findOne();
    if (item) {
      item.title = title || item.title;
      item.fileUrl = fileUrl || item.fileUrl;
      item.fileName = fileName || item.fileName;
      item.updatedAt = new Date();
      await item.save();
    } else {
      item = await AbstractTemplate.create({
        title: title || 'Official Abstract Submission Template',
        fileUrl,
        fileName: fileName || 'abstract-template.docx'
      });
    }
    res.json(item);
  } catch (error) {
    console.error('Save abstract template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteAbstractTemplate(req, res) {
  try {
    await AbstractTemplate.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    console.error('Delete abstract template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
