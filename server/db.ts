import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@shared/schema';
import dotenv from 'dotenv';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });

// Function to initialize the database (create tables, etc.)
export async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // This is a simple way to check if the connection is working
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0].now);
    
    // In a production app, you would use migrations with drizzle-kit
    // For this example, we'll manually create tables if they don't exist
    
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )
    `);
    
    // Persona templates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS persona_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        avatar_icon TEXT NOT NULL,
        default_traits JSONB NOT NULL,
        default_interests TEXT[] NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Personas table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS personas (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        template_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        tagline TEXT NOT NULL,
        avatar_icon TEXT NOT NULL,
        traits JSONB NOT NULL,
        interests TEXT[] NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        messaging_preference TEXT NOT NULL DEFAULT 'in-app',
        message_frequency TEXT NOT NULL DEFAULT 'daily',
        whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        whatsapp_number TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Conversations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        persona_id INTEGER NOT NULL,
        last_message_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        is_from_persona BOOLEAN NOT NULL DEFAULT FALSE,
        sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
        delivery_status TEXT NOT NULL DEFAULT 'sent',
        delivered_via TEXT NOT NULL DEFAULT 'in-app'
      )
    `);
    
    console.log('Database tables are ready');
    
    // Check if we need to add default persona templates
    const templateCount = await pool.query('SELECT COUNT(*) FROM persona_templates');
    
    if (parseInt(templateCount.rows[0].count) === 0) {
      console.log('Adding default persona templates...');
      
      // Insert persona templates
      await pool.query(`
        INSERT INTO persona_templates 
        (name, description, avatar_icon, default_traits, default_interests)
        VALUES 
        (
          'Creative Friend', 
          'Outgoing and creative persona who loves arts and culture', 
          'face', 
          '{"extroversion": 8, "emotional": 7, "playfulness": 8, "adventurous": 7}', 
          ARRAY['Art', 'Music', 'Travel', 'Photography']
        ),
        (
          'Tech Enthusiast', 
          'Analytical and tech-savvy persona who stays on top of innovations', 
          'computer', 
          '{"extroversion": 5, "emotional": 3, "playfulness": 6, "adventurous": 7}', 
          ARRAY['Technology', 'Gadgets', 'Programming', 'AI']
        ),
        (
          'Fitness Buddy', 
          'Energetic and motivating persona who encourages healthy habits', 
          'directions_run', 
          '{"extroversion": 9, "emotional": 6, "playfulness": 7, "adventurous": 9}', 
          ARRAY['Fitness', 'Nutrition', 'Sports', 'Wellness']
        ),
        (
          'Book Lover', 
          'Thoughtful and introspective persona who appreciates literature', 
          'book', 
          '{"extroversion": 3, "emotional": 8, "playfulness": 4, "adventurous": 5}', 
          ARRAY['Books', 'Writing', 'Philosophy', 'History']
        ),
        (
          'Foodie Friend', 
          'Passionate and adventurous persona who explores culinary delights', 
          'restaurant', 
          '{"extroversion": 7, "emotional": 8, "playfulness": 7, "adventurous": 8}', 
          ARRAY['Cooking', 'Restaurants', 'Food Culture', 'Wine']
        )
      `);
      
      console.log('Default persona templates added');
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}