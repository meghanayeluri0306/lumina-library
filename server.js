const express = require('express');
const fs = require('fs');
const cors = require('cors'); // Moved cors up
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors()); 
app.use(express.json());

// Helper function to read books
const readBooksData = () => {
    const data = fs.readFileSync('./books.json', 'utf-8');
    return JSON.parse(data);
};

// Helper function to write books
const writeBooksData = (data) => {
    fs.writeFileSync('./books.json', JSON.stringify(data, null, 2));
};

// --- API ROUTES ---

// Route 1: Get all books
app.get('/api/books', (req, res) => {
    try {
        const books = readBooksData();
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: "Error fetching books data" });
    }
});

// Route 2: Borrow a book (🌟 ADDED 1-TOPIC LIMIT LOGIC 🌟)
app.post('/api/borrow', (req, res) => {
    const { bookId, username } = req.body;
    let books = readBooksData();
    
    // 🌟 1. ముందుగా ఈ యూజర్ దగ్గర ఆల్రెడీ వేరే బుక్ ఉందేమో చెక్ చేస్తున్నాం
    let currentlyBorrowedBook = books.find(b => (b.activeBorrowers || []).includes(username));
    
    if (currentlyBorrowedBook) {
        // ఆల్రెడీ బుక్ ఉంటే, ఎర్రర్ పంపిస్తాం (వేరేది తీసుకోనివ్వము)
        return res.status(403).json({ 
            status: "LIMIT_REACHED",
            message: `You already have an active resource: "${currentlyBorrowedBook.title}". You must return it before borrowing another one.` 
        });
    }

    // 🌟 2. లేకపోతే మామూలుగా బుక్ కోసం వెతుకుతాం
    let book = books.find(b => b.id === bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    // Arrays లేకపోతే క్రియేట్ చేస్తాం (Safety check)
    book.activeBorrowers = book.activeBorrowers || [];
    book.waitingList = book.waitingList || [];

    if (book.availableTokens > 0) {
        book.availableTokens -= 1;
        book.activeBorrowers.push(username); // యూజర్ పేరుని లిస్ట్ లో సేవ్ చేస్తున్నాం
        writeBooksData(books);
        return res.json({ 
            status: "SUCCESS", 
            message: `Successfully borrowed ${book.title}! Token allocated.`,
            book: book
        });
    } else {
        if (!book.waitingList.includes(username)) {
            book.waitingList.push(username);
            writeBooksData(books);
        }
        const position = book.waitingList.indexOf(username) + 1;
        return res.json({ 
            status: "WAITLISTED", 
            message: `No tokens available. You have been added to the waiting list.`,
            position: position,
            book: book
        });
    }
});

// Route 3: Return a book (🌟 UPDATED TO REMOVE USER 🌟)
app.post('/api/return', (req, res) => {
    const { bookId, username } = req.body; // ఇప్పుడు ఎవరు రిటర్న్ చేస్తున్నారో కూడా తీసుకుంటున్నాం
    let books = readBooksData();
    let book = books.find(b => b.id === bookId);

    if (!book) return res.status(404).json({ message: "Book not found" });

    book.activeBorrowers = book.activeBorrowers || [];
    book.waitingList = book.waitingList || [];

    // 🌟 బుక్ రిటర్న్ చేయగానే యూజర్ పేరుని ఆ లిస్ట్ నుండి తీసేస్తున్నాం
    book.activeBorrowers = book.activeBorrowers.filter(user => user !== username);

    if (book.waitingList.length > 0) {
        const nextUser = book.waitingList.shift(); 
        book.activeBorrowers.push(nextUser); // వెయిటింగ్ లో ఉన్న వాళ్ళకి బుక్ ఇచ్చి, వాళ్ళ పేరు రాస్తున్నాం
        writeBooksData(books);
        return res.json({
            status: "PASSED_TO_QUEUE",
            message: `Book returned! License token automatically transferred to next waiting user: ${nextUser}.`,
            book: book
        });
    } 
    
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

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running perfectly on port ${PORT}`);
});
