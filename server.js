const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 5000;

// Middleware to allow our server to understand JSON data
app.use(express.json());

// Helper function to read books from our JSON "database"
const readBooksData = () => {
    const data = fs.readFileSync('./books.json', 'utf-8');
    return JSON.parse(data);
};

// Helper function to write updated books back to our JSON file
const writeBooksData = (data) => {
    fs.writeFileSync('./books.json', JSON.stringify(data, null, 2));
};
const cors = require('cors');
app.use(cors()); // Add this before your routes

// --- API ROUTES ---

// Route 1: Get all books (Used by both React and Flutter)
app.get('/api/books', (req, res) => {
    try {
        const books = readBooksData();
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: "Error fetching books data" });
    }
});

// Route 2: Borrow a book & manage Tokens / Waitlist (Your Unique Feature!)
app.post('/api/borrow', (req, res) => {
    const { bookId, username } = req.body;
    let books = readBooksData();
    
    // Find the book the user wants to borrow
    let book = books.find(b => b.id === bookId);
    
    if (!book) {
        return res.status(404).json({ message: "Book not found" });
    }

    // UNIQUE LOGIC: Check if tokens are available
    if (book.availableTokens > 0) {
        // Reduce available tokens by 1 because this user successfully borrowed it
        book.availableTokens -= 1;
        writeBooksData(books);
        return res.json({ 
            status: "SUCCESS", 
            message: `Successfully borrowed ${book.title}! Token allocated.`,
            book: book
        });
    } else {
        // NO TOKENS LEFT: Add user to the waiting list queue automatically
        if (!book.waitingList.includes(username)) {
            book.waitingList.push(username);
            writeBooksData(books);
        }
        
        // Calculate position in the queue
        const position = book.waitingList.indexOf(username) + 1;
        
        return res.json({ 
            status: "WAITLISTED", 
            message: `No tokens available. You have been added to the waiting list.`,
            position: position,
            book: book
        });
    }
});
// Route 3: Return a book & release tokens to waitlisted users
app.post('/api/return', (req, res) => {
    const { bookId } = req.body;
    let books = readBooksData();
    let book = books.find(b => b.id === bookId);

    if (!book) {
        return res.status(404).json({ message: "Book not found" });
    }

    // If there's someone waiting in the queue, give the token to them immediately!
    if (book.waitingList.length > 0) {
        const nextUser = book.waitingList.shift(); // Remove first user from queue
        writeBooksData(books);
        return res.json({
            status: "PASSED_TO_QUEUE",
            message: `Book returned! License token automatically transferred to next waiting user: ${nextUser}.`,
            book: book
        });
    } 
    
    // If no one is waiting, just increase the available tokens back up
    if (book.availableTokens < book.totalTokens) {
        book.availableTokens += 1;
        writeBooksData(books);
        return res.json({
            status: "RETURNED",
            message: `Book returned successfully. Token released back to pool.`,
            book: book
        });
    }

    res.json({ message: "All tokens are already available.", book: book });
});

const serverPort = process.env.PORT || 5000;
app.listen(serverPort, "0.0.0.0", () => {
    console.log(`Server running perfectly on port ${serverPort}`);
});