const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Product = require("../models/Product");
const Category = require("../models/Category");

// Convert category names into URL-friendly slugs
const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// GET /api/categories
// Return saved categories and categories already used by products

router.get("/", async (req, res, next) => {
  try {
    const savedCategories = await Category.find().sort({ name: 1 });
    const productCategories = await Product.distinct("category");

    const categoriesBySlug = new Map();

    for (const category of savedCategories) {
      categoriesBySlug.set(category.slug, {
        ...category.toObject(),
        managed: true,
      });
    }

    for (const name of productCategories.filter(Boolean)) {
      const slug = slugify(name);

      if (slug && !categoriesBySlug.has(slug)) {
        categoriesBySlug.set(slug, {
          name,
          slug,
          managed: false,
        });
      }
    }

    res.status(200).json(
      Array.from(categoriesBySlug.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
  } catch (error) {
    next(error);
  }
});


// POST /api/categories
// Create and save a category in MongoDB
router.post("/", async (req, res, next) => {
  try {
    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : "";

    if (!name) {
      return res.status(400).json({
        message: "Category name is required."
      });
    }

    const slug = slugify(name);

    if (!slug) {
      return res.status(400).json({
        message: "Please enter a valid category name."
      });
    }

    const existingCategory = await Category.findOne({
      $or: [
        { slug },
        { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }
      ]
    });

    if (existingCategory) {
      return res.status(409).json({
        message: "This category already exists.",
        category: existingCategory
      });
    }

    const category = await Category.create({ name, slug });

    return res.status(201).json({
      message: "Category created successfully.",
      category
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This category already exists."
      });
    }

    next(error);
  }
});


/**
 * PATCH /api/categories/:id
 * Rename an existing category.
 */
router.patch("/:id", async (req, res, next) => {
  try {
    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : "";

    if (!name) {
      return res.status(400).json({
        message: "Category name is required.",
      });
    }

    const slug = slugify(name);

    if (!slug) {
      return res.status(400).json({
        message: "Please enter a valid category name.",
      });
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found.",
      });
    }

    const duplicate = await Category.findOne({
      slug,
      _id: { $ne: category._id },
    });

    if (duplicate) {
      return res.status(409).json({
        message: "Another category already uses this name.",
      });
    }

    category.name = name;
    category.slug = slug;

    await category.save();

    return res.status(200).json({
      message: "Category updated successfully.",
      category,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid category ID.",
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: "This category already exists.",
      });
    }

    next(error);
  }
});

/**
 * DELETE /api/categories/:id
 * Delete a saved category.
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid category ID.",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found.",
      });
    }

    await Product.updateMany(
      {
        $or: [
          { categoryId: category._id },
          { category: category.name },
          { category: category.slug },
        ],
      },
      {
        $set: {
          category: "uncategorized",
          categoryId: null,
        },
      }
    );

    await Category.findByIdAndDelete(category._id);

    return res.status(200).json({
      message: "Category deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

    // Keep products, but mark products assigned to this category
    // as uncategorized, matching the admin confirmation message.
    // await Product.updateMany(
    //   { category: { $in: [category.name, category.slug] } },
    //   { $set: { category: "uncategorized" } }
    // );

    // await Category.findByIdAndDelete(category._id);

    // return res.status(200).json({
    //   message: "Category deleted successfully.",
    // });
//   } catch (error) {
//     if (error.name === "CastError") {
//       return res.status(400).json({
//         message: "Invalid category ID.",
//       });
//     }

//     next(error);
//   }
// });


module.exports = router;