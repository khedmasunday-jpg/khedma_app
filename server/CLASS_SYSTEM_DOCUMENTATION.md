# 6-Class Progression System

## Overview
The system now supports a 3-year, 6-class progression structure where students advance through classes in a structured manner.

## Class Structure

### Year 1
- **Class 1** (Level 1)
- **Class 2** (Level 2)

### Year 2  
- **Class 3** (Level 3)
- **Class 4** (Level 4)

### Year 3
- **Class 5** (Level 5)
- **Class 6** (Level 6) - Final class before graduation

## Student Progression
Students progress through classes in the following order:
1. **Year 1**: Class 1 → Class 2
2. **Year 2**: Class 3 → Class 4  
3. **Year 3**: Class 5 → Class 6 → **Graduation**

## Database Changes

### Student Model
- `classLevel`: Now supports values 1-6 (previously 1-3)
- Students automatically progress through all 6 classes

### Class Model
- `level`: Class level (1-6)
- `year`: Academic year (1-3)
- Added year field to group classes by academic year

### User Model
- `assignedlevel`: Co-principals can be assigned to levels 1-6
- Co-principals manage classes within their assigned year

## Promotion System

### Automatic Promotion
- Runs yearly on September 14th at 2:00 AM
- Promotes all students: 1→2, 2→3, 3→4, 4→5, 5→6
- Students in Class 6 are marked for graduation and exported to CSV

### Class Assignment Updates
- Automatically updates student class assignments after promotion
- Updates class student lists
- Maintains data consistency

## Role-Based Access

### Principal
- Can view and manage all 6 classes
- Full access to all students and teachers

### Co-Principal
- Manages classes within their assigned year:
  - Level 1-2: Manages Year 1 (Classes 1-2)
  - Level 3-4: Manages Year 2 (Classes 3-4)  
  - Level 5-6: Manages Year 3 (Classes 5-6)

### Teacher
- Assigned to specific classes
- Can view and manage their assigned class students

## Setup Instructions

### 1. Initialize Classes
Run the setup script to create the 6 classes:
```bash
cd server
node setup-classes.js
```

### 2. Assign Co-Principals
Assign co-principals to appropriate levels:
- Level 1-2: Year 1 co-principal
- Level 3-4: Year 2 co-principal
- Level 5-6: Year 3 co-principal

### 3. Assign Teachers
Assign teachers to specific classes (1-6)

## API Endpoints

### Classes
- `GET /api/classes` - Get classes based on user role
- `GET /api/classes/:classId/students` - Get students in a class
- `GET /api/classes/:classId/students-detailed` - Get detailed student data

### Co-Principal Endpoints
- `GET /api/classes/co-classes` - Get classes in co-principal's year
- `GET /api/classes/co-principal/teachers` - Get teachers under co-principal
- `GET /api/classes/co-principal/students` - Get students in co-principal's year

## Migration Notes

### Existing Data
- Students with `classLevel` 1-3 will continue to work
- Existing classes will need to be updated with year information
- Run the setup script to create the new class structure

### Graduation Process
- Students reaching Class 6 are automatically exported to CSV
- Graduation data is saved to `server/exports/graduates.csv`
- Graduates can be removed from the system after export

## Benefits

1. **Structured Progression**: Clear path from Class 1 to graduation
2. **Year-Based Management**: Co-principals manage by academic year
3. **Automatic Promotion**: Reduces manual work for yearly promotions
4. **Data Consistency**: Maintains relationships between students and classes
5. **Graduation Tracking**: Automatic export of graduating students
