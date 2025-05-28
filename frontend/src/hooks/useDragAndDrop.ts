import { useState } from 'react';
import { EditorSlide } from '../components/SlideEditor';

export const useDragAndDrop = (
  slides: EditorSlide[], 
  setSlides: React.Dispatch<React.SetStateAction<EditorSlide[]>>,
  onReorder?: (updatedSlides: EditorSlide[]) => void
) => {
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    const target = e.target as HTMLElement;
    const isTextField = target.closest('.MuiTextField-root') !== null;
    
    if (isTextField) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    setDraggedItemIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLDivElement;
    
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    
    target.style.borderTop = draggedItemIndex < index ? '2px solid #1976d2' : 'none';
    target.style.borderBottom = draggedItemIndex > index ? '2px solid #1976d2' : 'none';
  };
  
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLDivElement;
    target.style.borderTop = 'none';
    target.style.borderBottom = 'none';
  };
  
  const onDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLDivElement;
    target.style.borderTop = 'none';
    target.style.borderBottom = 'none';
    
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) {
      setDraggedItemIndex(null);
      return;
    }

    const newSlides = [...slides];
    const draggedItem = newSlides.splice(draggedItemIndex, 1)[0];
    newSlides.splice(targetIndex, 0, draggedItem);
    
    const updatedSlides = newSlides.map((slide, idx) => ({
      ...slide,
      index: idx
    }));
    
    setSlides(updatedSlides);
    
    if (onReorder) {
      onReorder(updatedSlides);
    }
    
    setDraggedItemIndex(null);
  };

  const onDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLDivElement;
    target.style.borderTop = 'none';
    target.style.borderBottom = 'none';
    setDraggedItemIndex(null);
  };

  return {
    draggedItemIndex,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd
  };
};