const router = require('express').Router()
const db = require('./db')

router
  .route('/inventory')
  // GET route that returns a list of everything in the inventory table
  .get(async (req, res) => {
    const [inventoryItems] = await db.query(
      `SELECT
        id,
        name,
        image,
        description,
        price,
        quantity
      FROM inventory`
    );
    res.json(inventoryItems);
  })
 
  .post(async (req, res) => {
    const { name, image, description, price, quantity } = req.body;
  
    // Insert inventory item into the database
    await db.query(
      `INSERT INTO inventory (name, image, description, price, quantity) 
       VALUES (?, ?, ?, ?, ?)`,
      [name, image, description, price, quantity]
    );
  
    // Return a 204 status if the insert is successful
    res.status(204).end();
  });

router
.route('/inventory/:id')
// GET route that returns a single item from the inventory
.get(async (req, res) => {
  const { id } = req.params;

  // find the inventory item by ID
  const [[item]] = await db.query(
    `SELECT * FROM inventory WHERE id = ?`,
    [id]
  );
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

  res.json(item);
})

// PUT route that updates the inventory table based on the id
.put(async (req, res) => {
  const { id } = req.params;
  const { name, image, description, price, quantity } = req.body;
  
 const [result] = await db.query(
    `UPDATE inventory 
     SET name = ?, image = ?, description = ?, price = ?, quantity = ? 
     WHERE id = ?`,
    [name, image, description, price, quantity, id]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Item not found' });
  }
  res.status(204).end(); // Return 204 status code if modified
})

// DELETE route that deletes an item from the inventory table
.delete(async (req, res) => {
  const { id } = req.params;

  const [result] = await db.query(
    `DELETE FROM inventory WHERE id = ?`,
    [id]
  );

if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Item not found' });
  }
  res.status(204).end(); // Return 204 status code if deleted
});


router
  .route('/cart')
  .get(async (req, res) => {
    const [cartItems] = await db.query(
      `SELECT
        cart.id,
        cart.inventory_id AS inventoryId,
        cart.quantity,
        inventory.price,
        inventory.name,
        inventory.image,
        inventory.quantity AS inventoryQuantity
      FROM cart INNER JOIN inventory ON cart.inventory_id=inventory.id`
    )
    const [[{total}]] = await db.query(
      `SELECT SUM(cart.quantity * inventory.price) AS total
       FROM cart, inventory WHERE cart.inventory_id=inventory.id`
    )
    res.json({cartItems, total: total || 0})
  })
 
  .post(async (req, res) => {
    const {inventoryId, quantity} = req.body
    // Using a LEFT JOIN ensures that we always return an existing
    // inventory item row regardless of whether that item is in the cart.
    const [[item]] = await db.query(
      `SELECT
        inventory.id,
        name,
        price,
        inventory.quantity AS inventoryQuantity,
        cart.id AS cartId
      FROM inventory
      LEFT JOIN cart on cart.inventory_id=inventory.id
      WHERE inventory.id=?;`,
      [inventoryId]
    )
    if (!item) return res.status(404).send('Item not found')
    const {cartId, inventoryQuantity} = item
    if (quantity > inventoryQuantity)
      return res.status(409).send('Not enough inventory')
    if (cartId) {
      await db.query(
        `UPDATE cart SET quantity=quantity+? WHERE inventory_id=?`,
        [quantity, inventoryId]
      )
    } else {
      await db.query(
        `INSERT INTO cart(inventory_id, quantity) VALUES (?,?)`,
        [inventoryId, quantity]
      )
    }
    res.status(204).end()
  })
  
  .delete(async (req, res) => {
    // Deletes the entire cart table
    await db.query('DELETE FROM cart')
    res.status(204).end()
  })

router
  .route('/cart/:cartId')
  .put(async (req, res) => {
    const {quantity} = req.body
    const [[cartItem]] = await db.query(
      `SELECT
        inventory.quantity as inventoryQuantity
        FROM cart
        INNER JOIN inventory on cart.inventory_id=inventory.id
        WHERE cart.id=?`,
        [req.params.cartId]
    )
    if (!cartItem)
      return res.status(404).send('Not found')
    const {inventoryQuantity} = cartItem
    if (quantity > inventoryQuantity)
      return res.status(409).send('Not enough inventory')
    if (quantity > 0) {
      await db.query(
        `UPDATE cart SET quantity=? WHERE id=?`
        ,[quantity, req.params.cartId]
      )
    } else {
      await db.query(
        `DELETE FROM cart WHERE id=?`,
        [req.params.cartId]
      )
    }
    res.status(204).end()
  })
  .delete(async (req, res) => {
    const [{affectedRows}] = await db.query(
      `DELETE FROM cart WHERE id=?`,
      [req.params.cartId]
    )
    if (affectedRows === 1)
      res.status(204).end()
    else
      res.status(404).send('Cart item not found')
  })

module.exports = router
