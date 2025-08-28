
import React from 'react';

const Hero: React.FC = () => {
    return (
        <section className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 text-center py-20 sm:py-24 lg:py-32">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight">
                    Every tool you need to work with PDFs in one place
                </h1>
                <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    Completely free, secure, and easy to use. Convert, merge, or edit your PDF files without ever leaving your browser.
                </p>
            </div>
        </section>
    );
};

export default Hero;
