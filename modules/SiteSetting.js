// optional

const { Schema, model } = require('mongoose');

const SiteSettingSchema = new Schema({
  brand: { name: String, logoUrl: String },
  contact: { email: String, phone: String, address: String, mapUrl: String },
  social: { facebook: String, instagram: String, linkedin: String, youtube: String },
  defaultSEO: { title: String, description: String, ogImage: String },
  home: { sections: { hero: Boolean, featuredProducts: Boolean, blog: Boolean } }
}, { timestamps: true });

module.exports = model('SiteSetting', SiteSettingSchema);