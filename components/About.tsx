
import React from 'react';

const About: React.FC = () => {
    return (
        <section id="about" className="py-16 bg-white dark:bg-gray-800">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 reveal">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center">
                    About DocxTools
                </h2>
                <div className="mt-8 prose prose-lg dark:prose-invert mx-auto text-gray-600 dark:text-gray-300">
                    <p>
                        DocxTools was created to offer a simple, free, and powerful set of tools for anyone working with documents. In today's digital world, PDFs are everywhere, but managing them can be a hassle. We believe you shouldn't need to download bulky software or pay for expensive subscriptions to perform basic tasks like merging, splitting, or converting your files.
                    </p>
                    <h3 className="text-gray-800 dark:text-gray-200">Why are PDF tools essential?</h3>
                    <p>
                        Whether you're a student, a professional, or just managing personal documents, you'll inevitably need to manipulate a PDF. Our tools are designed to be intuitive and solve real-world problems instantly.
                    </p>
                    <ul>
                        <li><strong>Merge PDF:</strong> Combine multiple reports, invoices, or chapters into a single, organized document.</li>
                        <li><strong>Split PDF:</strong> Extract specific pages from a large file without needing the entire document.</li>
                        <li><strong>Compress PDF:</strong> Reduce file size for easy emailing and sharing without compromising quality significantly.</li>
                        <li><strong>Convert Files:</strong> Seamlessly switch between formats like Word, PowerPoint, Excel, and PDF to suit your needs.</li>
                        <li><strong>Edit & Sign:</strong> Make quick edits, add annotations, or securely sign documents from anywhere, on any device.</li>
                    </ul>
                    <h3 className="text-gray-800 dark:text-gray-200">Your Privacy is Our Priority</h3>
                    <p>
                        Unlike other online services, DocxTools processes all your files directly in your web browser. This means your files are never uploaded to our servers. Your data remains private and secure on your own computer, giving you complete peace of mind.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default About;
